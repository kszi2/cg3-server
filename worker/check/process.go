package check

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"slices"
	"strings"

	"github.com/kszi2/cg3-server/backend/db"
)

type checkResult struct {
	out        string
	err        string
	attach     []byte
	attachType string
}

type cg3Report struct {
	Check      string `json:"check"`
	Diagnostic string `json:"diagnostic"`
	File       string `json:"file"`
	Line       uint   `json:"line"`
	Column     uint   `json:"column"`
}

type CheckProcess struct {
	results map[string]checkResult
	runID   uint
}

var checks = []string{"unzip", "sanity", "debugmalloc", "compile", "cg3-complete", "cg3-arityck", "cg3-bugmalloc", "cg3-chonktion", "cg3-fio", "cg3-fleak", "cg3-globus", "cg3-hunktion", "cg3-t", "cg"}

func New(runID uint) *CheckProcess {
	res := make(map[string]checkResult)

	for _, key := range checks {
		res[key] = checkResult{}
	}

	return &CheckProcess{
		results: res,
		runID:   runID,
	}
}

func (check *CheckProcess) AddFile(reader io.Reader, name string) error {
	parts := strings.Split(name, "/")

	if len(parts) != 3 {
		return nil
	}

	if parts[0] != "out" {
		return fmt.Errorf("invalid folder start: %v", parts[0])
	}

	checkname := parts[1]
	filename := parts[2]

	switch checkname {
	case "0100-unzip":
		res := check.results["unzip"]
		fillResult(filename, reader, &res)
		check.results["unzip"] = res
	case "0110-sanity":
		res := check.results["sanity"]
		fillResult(filename, reader, &res)
		check.results["sanity"] = res
	case "0120-debugmalloc":
		res := check.results["debugmalloc"]
		fillResult(filename, reader, &res)
		check.results["debugmalloc"] = res
	case "0121-debugmalloc-replace":

	case "0200-compile":
		res := check.results["compile"]
		if !fillResult(filename, reader, &res) && filename == "main" {
			res.attach = readBytes(reader)
			res.attachType = "application/octet-stream"
		}
		check.results["compile"] = res
	case "0300-cg3":
		res := check.results["cg3-complete"]
		if !fillResult(filename, reader, &res) && filename == "report.json" {
			report := []cg3Report{}

			res.attach = readBytes(reader)
			res.attachType = "application/json"

			err := json.Unmarshal(res.attach, &report)
			if err != nil {
				return err
			}

			slices.SortFunc(report, func(a cg3Report, b cg3Report) int {
				return int(b.Line) - int(a.Line)
			})
			slices.SortStableFunc(report, func(a cg3Report, b cg3Report) int {
				return strings.Compare(b.File, a.File)
			})
			slices.SortStableFunc(report, func(a cg3Report, b cg3Report) int {
				return strings.Compare(b.Check, a.Check)
			})

			for _, cg3Report := range report {
				res2 := check.results[fmt.Sprintf("cg3-%v", cg3Report.Check)]
				if res2.err != "" {
					res2.err += "\n"
				}
				res2.err += formatCG3Report(cg3Report)
				check.results[fmt.Sprintf("cg3-%v", cg3Report.Check)] = res2
			}
		}
		check.results["cg3-complete"] = res

	case "0400-cg":
		res := check.results["cg"]
		if !fillResult(filename, reader, &res) && filename == "cg.pdf" {
			res.attach = readBytes(reader)
			res.attachType = "application/pdf"
		}
		if filename == "error" {
			res.err = strings.TrimSpace(res.err)
		}
		check.results["cg"] = res
	default:
		return fmt.Errorf("invalid check: %v", checkname)
	}

	return nil
}

func (check *CheckProcess) GetResult() []db.CheckResult {
	ret := []db.CheckResult{}

	for checkname, result := range check.results {
		ret1 := db.CheckResult{
			Check:          checkname,
			Attachment:     result.attach,
			AttachmentType: &result.attachType,
			RunID:          check.runID,
		}

		if result.out == "" && result.err == "" {
			ret1.Result = 0
			if strings.HasPrefix(checkname, "cg3") || checkname == "cg" {
				ret1.Result = 1
			}
		} else if result.err == "" {
			ret1.Result = 1
			ret1.Notes = &result.out
		} else {
			ret1.Result = -1
			str := strings.TrimSpace(strings.Join([]string{result.out, result.err}, "\n"))
			ret1.Notes = &str
		}

		ret = append(ret, ret1)
	}

	return ret
}

func readString(reader io.Reader) string {
	buf := new(strings.Builder)
	io.Copy(buf, reader)
	return buf.String()
}

func readBytes(reader io.Reader) []byte {
	buf := new(bytes.Buffer)
	io.Copy(buf, reader)
	return buf.Bytes()
}

func fillResult(fname string, reader io.Reader, result *checkResult) bool {
	if result == nil {
		return false
	}

	switch fname {
	case "out":
		result.out = readString(reader)
		return true
	case "error":
		result.err = readString(reader)
		return true
	}

	return false
}

func formatCG3Report(report cg3Report) string {
	return fmt.Sprintf("%v:%v:%v %v", report.File, report.Line, report.Column, report.Diagnostic)
}
