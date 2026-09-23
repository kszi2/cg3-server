package check

import (
	"archive/tar"
	"bytes"
	"context"
	"fmt"
	"io"
	"log"
	"path/filepath"
	"time"

	"github.com/google/uuid"
	"github.com/kszi2/cg3-server/backend/db"
	"github.com/kszi2/cg3-server/backend/helper"
	"github.com/moby/moby/api/types/container"
	"github.com/moby/moby/client"
)

func Run(ctx context.Context, id uint) error {
	cli, err := client.New(client.FromEnv)
	if err != nil {
		return err
	}
	defer cli.Close()

	ctList, err := cli.ContainerList(ctx, client.ContainerListOptions{
		All: true,
	})
	if err == nil {
		for _, ct := range ctList.Items {
			if len(ct.Names) < 1 {
				continue
			}
			if time.Since(time.Unix(ct.Created, 0)) > time.Hour && ct.Labels["hu.kszi2.cg3.check.id"] != "" {
				log.Printf("found old container: %v, removing", ct.Names[0])
				cli.ContainerRemove(ctx, ct.ID, client.ContainerRemoveOptions{
					Force: true,
				})
			}
		}
	}

	resp, err := cli.ContainerCreate(ctx,
		client.ContainerCreateOptions{
			Image: helper.EnvGet("CG3_DOCKER_IMAGE", "kisbogdan/cg3-checker"),
			Name:  fmt.Sprintf("cg3-check-autorun-%v-%v", id, uuid.New().String()),
			Config: &container.Config{
				Cmd: []string{"/cg3/cg.sh"},
				Labels: map[string]string{
					"hu.kszi2.cg3.check.id": fmt.Sprintf("%v", id),
				},
			},
			HostConfig: &container.HostConfig{
				NetworkMode: "none",
				Resources: container.Resources{
					Memory:    1024 * 1024 * 1024,                     // 1GiB
					NanoCPUs:  2 * 1e9,                                // 2 cores
					PidsLimit: func(i int64) *int64 { return &i }(50), // prevent fork bombs
				},
				CapDrop: []string{"ALL"}, // drop all Linux capabilities
			},
		})
	if err != nil {
		return err
	}

	// Always ensure cleanup happens at the very end
	defer cli.ContainerRemove(context.Background(), resp.ID, client.ContainerRemoveOptions{
		Force: true,
	})

	// 2. (Optional) Copy source code in using cli.CopyToContainer...
	var run db.CGRun
	err = db.DB.Where(id).First(&run).Error
	if err != nil {
		return err
	}

	var archive bytes.Buffer
	tw := tar.NewWriter(&archive)
	if err := tw.WriteHeader(&tar.Header{
		Name: "input.zip",
		Mode: 0600,
		Size: int64(len(run.Source)),
	}); err != nil {
		return err
	}
	if _, err := tw.Write(run.Source); err != nil {
		return err
	}
	if err := tw.Close(); err != nil {
		return err
	}

	_, err = cli.CopyToContainer(ctx, resp.ID, client.CopyToContainerOptions{
		DestinationPath: "/cg3",
		Content:         bytes.NewReader(archive.Bytes()),
	})
	if err != nil {
		return err
	}

	// 3. Run and block until completion
	if _, err := cli.ContainerStart(ctx, resp.ID, client.ContainerStartOptions{}); err != nil {
		return err
	}

	waitRes := cli.ContainerWait(ctx, resp.ID, client.ContainerWaitOptions{
		Condition: container.WaitConditionNotRunning,
	})
	select {
	case err := <-waitRes.Error:
		if err != nil {
			return fmt.Errorf("error waiting for container: %w", err)
		}
	case <-waitRes.Result:
	}

	// 4. Extract the target directory or file (returns a tar stream)
	copyRes, err := cli.CopyFromContainer(ctx, resp.ID, client.CopyFromContainerOptions{SourcePath: "/cg3/out/"})
	if err != nil {
		return fmt.Errorf("failed to copy files from container: %w", err)
	}
	defer copyRes.Content.Close()

	err = process(copyRes.Content, id)
	if err != nil {
		return err
	}

	return nil
}

func process(reader io.Reader, id uint) error {
	tr := tar.NewReader(reader)

	checkResult := New(id)

	for {
		header, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}

		// Prevent zip-slip directory traversal
		cleanName := filepath.Clean(header.Name)

		if header.Typeflag == tar.TypeReg {
			checkResult.AddFile(tr, cleanName)
		}
	}

	err := db.DB.Where(&db.CheckResult{RunID: id}).Delete(&db.CheckResult{}).Error
	if err != nil {
		return err
	}

	results := checkResult.GetResult()
	err = db.DB.Create(results).Error
	if err != nil {
		return err
	}

	err = db.DB.Model(&db.CGRun{}).Where(id).Update("check_time", time.Now()).Error
	if err != nil {
		return err
	}

	return nil
}
