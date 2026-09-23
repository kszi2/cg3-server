package check

import (
	"archive/zip"
	"bytes"
	"crypto/md5"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	common_api "github.com/kszi2/cg3-server/backend/api/common"
	"github.com/kszi2/cg3-server/backend/api/teacher/students"
	"github.com/kszi2/cg3-server/backend/api/teacher/user"
	"github.com/kszi2/cg3-server/backend/db"
	"github.com/kszi2/cg3-server/backend/queue"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type UploadCheck struct {
	NeptunHash *string `json:"neptunHash"`
	Source     *string `json:"source"`
}

const (
	MaxSourceSize          = 1 << 20
	maxExpandedZipSize     = 64 << 20
	maxZipCompressionRatio = 100
)

type CGRunStatusReturn struct {
	Status    string     `json:"status"`
	CheckTime *time.Time `json:"checkedAt"`
}

type CGRunReturnSum struct {
	ID uint `json:"-"`

	GuestUpload bool       `json:"guest"`
	RunID       *uuid.UUID `json:"uuid"`
	CreatedAt   *time.Time `json:"createdAt"`

	CreatedBy *uint            `json:"-"`
	User      *user.UserReturn `gorm:"foreignKey:CreatedBy" json:"user"`

	StudentID *uint                   `json:"-"`
	Student   *students.StudentReturn `gorm:"foreignKey:StudentID" json:"student"`

	CheckTime *time.Time `json:"checkedAt"`
}

type CGRunReturn struct {
	CGRunReturnSum

	Source       []byte  `json:"-"`
	SourceBase64 *string `gorm:"-" json:"source"`

	CheckResults []CheckResultReturn `gorm:"foreignKey:RunID" json:"checkResults"`
}

type CheckResultReturn struct {
	RunID uint `json:"-"`

	Check  string  `json:"check"`
	Result int     `json:"result"`
	Notes  *string `json:"notes"`

	Attachment       []byte  `json:"-"`
	AttachmentBase64 *string `gorm:"-" json:"attachment"`
	AttachmentType   *string `json:"attachmentType"`
}

func Register(router *gin.RouterGroup) {
	router.POST("", handleUpload)
	router.GET("/student/:id", handleStudentRuns)
	router.GET("/all", handleAll)
	router.DELETE("/:id", handleDelete)
	router.GET("/:id", handleRun)
	router.GET("/:id/status", handleRunStatus)
}

func handleUpload(c *gin.Context) {
	ok, claims := common_api.ValidateJWT(c)
	if !ok {
		return
	}

	var upload UploadCheck
	if err := c.ShouldBindJSON(&upload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if upload.Source == nil || *upload.Source == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "source is required"})
		return
	}

	source, err := base64.StdEncoding.DecodeString(*upload.Source)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "source is not valid base64"})
		return
	}
	if len(source) > MaxSourceSize {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "source must not exceed 1 MiB"})
		return
	}
	if err := ValidateZip(source); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "source is not a valid ZIP file"})
		return
	}

	runID := uuid.New()
	md5sum := md5.Sum(source)

	run := db.CGRun{
		GuestUpload: false,
		Source:      source,
		CreatedBy:   &claims.UserID,
		RunID:       &runID,
		SourceMD5:   md5sum[:],
	}
	if upload.NeptunHash != nil {
		student := db.Student{}
		if err := db.DB.Where(&db.Student{NeptunHash: *upload.NeptunHash}).First(&student).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				c.JSON(http.StatusBadRequest, gin.H{"error": "student not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
			return
		}
		run.StudentID = &student.ID
		run.Student = &student
	}

	var existingRun db.CGRun
	err = db.DB.
		Session(&gorm.Session{
			Logger: logger.Default.LogMode(logger.Silent),
		}).
		Preload("User").
		Preload("Student").
		Where(&db.CGRun{SourceMD5: run.SourceMD5}).
		First(&existingRun).
		Error
	if err == nil {
		sum := CGRunReturnSum{
			GuestUpload: existingRun.GuestUpload,
			RunID:       existingRun.RunID,
			User:        user.User2Return(existingRun.User),
			CreatedAt:   &existingRun.CreatedAt,
			Student:     students.Student2Return(existingRun.Student),
			CheckTime:   existingRun.CheckTime,
		}

		c.JSON(http.StatusOK, &sum)
		return
	}

	if err := db.DB.Create(&run).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if err := queue.Send(strconv.FormatUint(uint64(run.ID), 10), 10); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to queue run"})
		return
	}

	db.DB.Where(run.CreatedBy).First(&run.User)

	sum := CGRunReturnSum{
		GuestUpload: run.GuestUpload,
		RunID:       run.RunID,
		User:        user.User2Return(run.User),
		CreatedAt:   &run.CreatedAt,
		Student:     students.Student2Return(run.Student),
		CheckTime:   run.CheckTime,
	}

	c.JSON(http.StatusOK, &sum)
}

func ValidateZip(source []byte) error {
	reader, err := zip.NewReader(bytes.NewReader(source), int64(len(source)))
	if err != nil {
		return err
	}
	if len(reader.File) == 0 {
		return fmt.Errorf("ZIP is empty")
	}

	var expandedSize uint64
	for _, file := range reader.File {
		if file.UncompressedSize64 > maxExpandedZipSize-expandedSize {
			return fmt.Errorf("ZIP expands beyond limit")
		}
		if file.CompressedSize64 == 0 {
			if file.UncompressedSize64 != 0 {
				return fmt.Errorf("ZIP entry has invalid size")
			}
		} else if file.UncompressedSize64/file.CompressedSize64 > maxZipCompressionRatio {
			return fmt.Errorf("ZIP compression ratio is too high")
		}

		opened, err := file.Open()
		if err != nil {
			return err
		}
		remaining := int64(maxExpandedZipSize - expandedSize)
		written, copyErr := io.Copy(io.Discard, io.LimitReader(opened, remaining+1))
		closeErr := opened.Close()
		if copyErr != nil {
			return copyErr
		}
		if closeErr != nil {
			return closeErr
		}
		if written > remaining {
			return fmt.Errorf("ZIP expands beyond limit")
		}
		expandedSize += uint64(written)
	}
	return nil
}

func handleStudentRuns(c *gin.Context) {
	if ok, _ := common_api.ValidateJWT(c); !ok {
		return
	}

	student := db.Student{}
	if err := db.DB.Where(&db.Student{NeptunHash: c.Param("id")}).First(&student).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "student not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	var runs []CGRunReturnSum
	query := db.DB.
		Model(&db.CGRun{}).
		Preload("Student", func(tx *gorm.DB) *gorm.DB {
			return tx.Model(&db.Student{})
		}).
		Preload("User", func(tx *gorm.DB) *gorm.DB {
			return tx.Model(&db.User{})
		}).
		Where(&db.CGRun{StudentID: &student.ID}).
		Find(&runs)
	if query.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	c.JSON(http.StatusOK, &runs)
}

func handleAll(c *gin.Context) {
	ok, _ := common_api.ValidateJWTAdmin(c)
	if !ok {
		return
	}

	var runs []CGRunReturnSum
	query := db.DB.
		Model(&db.CGRun{}).
		Preload("Student", func(tx *gorm.DB) *gorm.DB {
			return tx.Model(&db.Student{})
		}).
		Preload("User", func(tx *gorm.DB) *gorm.DB {
			return tx.Model(&db.User{})
		}).
		Find(&runs)
	if query.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	c.JSON(http.StatusOK, runs)
}

func handleRun(c *gin.Context) {
	if ok, _ := common_api.ValidateJWT(c); !ok {
		return
	}

	runID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid run UUID"})
		return
	}

	var run CGRunReturn
	query := db.DB.
		Model(&db.CGRun{}).
		Preload("Student", func(tx *gorm.DB) *gorm.DB {
			return tx.Model(&db.Student{})
		}).
		Preload("User", func(tx *gorm.DB) *gorm.DB {
			return tx.Model(&db.User{})
		}).
		Preload("CheckResults", func(tx *gorm.DB) *gorm.DB {
			return tx.Model(&db.CheckResult{})
		}).
		Where(&db.CGRun{RunID: &runID}).
		First(&run)
	if errors.Is(query.Error, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "run not found"})
		return
	}
	if query.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	for i, result := range run.CheckResults {
		run.CheckResults[i].AttachmentBase64 = BytesToString(result.Attachment)
	}
	run.SourceBase64 = BytesToString(run.Source)

	c.JSON(http.StatusOK, &run)
}

func handleRunStatus(c *gin.Context) {
	if ok, _ := common_api.ValidateJWT(c); !ok {
		return
	}

	runID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid run UUID"})
		return
	}

	var run CGRunReturnSum
	query := db.DB.Model(&db.CGRun{}).Where(&db.CGRun{RunID: &runID}).First(&run)
	if errors.Is(query.Error, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "run not found"})
		return
	}
	if query.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ret := CGRunStatusReturn{
		CheckTime: run.CheckTime,
	}

	if run.CheckTime != nil {
		ret.Status = "done"
	} else {
		ret.Status = "pending"
	}

	c.JSON(http.StatusOK, &ret)
}

func handleDelete(c *gin.Context) {
	ok, _ := common_api.ValidateJWTAdmin(c)
	if !ok {
		return
	}

	runID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid run UUID"})
		return
	}

	err = db.DB.Where(&db.CGRun{RunID: &runID}).Delete(&db.CGRun{}).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "run not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

func BytesToString(value []byte) *string {
	if value == nil {
		return nil
	}
	encoded := base64.StdEncoding.EncodeToString(value)
	return &encoded
}
