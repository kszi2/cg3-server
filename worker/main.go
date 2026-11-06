package main

import (
	"context"
	"fmt"
	"log"
	"strconv"
	"time"

	"github.com/kszi2/cg3-server/backend/db"
	"github.com/kszi2/cg3-server/backend/queue"
	"github.com/kszi2/cg3-server/checker/check"
	"gorm.io/gorm"
)

func main() {
	err := db.DbConnect(false)
	if err != nil {
		log.Fatal(err)
	}

	err = queue.Connect()
	defer queue.Disconnect()
	if err != nil {
		log.Fatal(err)
	}

	msgs, err := queue.GetConsumer()
	if err != nil {
		log.Fatal(err)
	}

	err = check.CheckDockerClient(context.Background())
	if err != nil {
		log.Fatal(err)
	}

	for d := range msgs {
		id, err := strconv.ParseUint(string(d.Body), 10, 0)
		if err != nil {
			logWorkerAction(0, time.Duration(0), fmt.Errorf("invalid run ID %q: %w", d.Body, err), nil)
			continue
		}
		runID := uint(id)

		ctx, cancel := context.WithTimeout(context.Background(), time.Second*120)
		start := time.Now()
		log.Printf("running check for %v", runID)
		err = check.Run(ctx, runID)
		duration := time.Since(start)
		log.Printf("done in %s", duration)
		cancel()

		if err != nil {
			log.Printf("error: %v", err)
		}
		logWorkerAction(runID, duration, err, loadRun(runID))
	}
}

func loadRun(id uint) *db.CGRun {
	run := &db.CGRun{}
	if err := db.DB.Preload("User").Preload("Student").First(run, id).Error; err != nil {
		if err != gorm.ErrRecordNotFound {
			log.Printf("failed to load run %d for action log: %v", id, err)
		}
		return nil
	}
	return run
}

func logWorkerAction(id uint, duration time.Duration, actionErr error, run *db.CGRun) {
	entry := db.Log{
		Type:    "run",
		Time:    time.Now(),
		CGRunID: &id,
		StatusCode: func() *uint {
			status := uint(200)
			if actionErr != nil {
				status = 500
			}
			return &status
		}(),
		Details: fmt.Sprintf("checks completed in %s", duration),
	}

	if run != nil {
		entry.StudentID = run.StudentID
	}
	if actionErr != nil {
		entry.Details = fmt.Sprintf("checks failed after %s: %v", duration, actionErr)
	}

	if err := db.DB.Create(&entry).Error; err != nil {
		log.Printf("failed to save worker action log for run %d: %v", id, err)
	}
}
