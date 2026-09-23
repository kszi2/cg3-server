package check

import (
	"crypto/md5"
	"encoding/base64"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	teacher_check "github.com/kszi2/cg3-server/backend/api/teacher/check"
	"github.com/kszi2/cg3-server/backend/api/teacher/students"
	"github.com/kszi2/cg3-server/backend/db"
	"github.com/kszi2/cg3-server/backend/queue"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type CGRunCreateReturn struct {
	RunID     *uuid.UUID `json:"uuid"`
	CreatedAt *time.Time `json:"createdAt"`

	StudentID *uint                   `json:"-"`
	Student   *students.StudentReturn `gorm:"foreignKey:StudentID" json:"student"`
}

type CGRunReturn struct {
	ID uint `json:"-"`

	CreatedAt *time.Time `json:"createdAt"`

	StudentID *uint                   `json:"-"`
	Student   *students.StudentReturn `gorm:"foreignKey:StudentID" json:"student"`

	CheckTime *time.Time `json:"checkedAt"`

	CheckResults []teacher_check.CheckResultReturn `gorm:"foreignKey:RunID" json:"checkResults"`
}

func Register(router *gin.RouterGroup) {
	router.POST("", handleUpload)
	router.GET("/:id", handleRun)
	router.GET(":id/status", handleRunStatus)
}

func handleUpload(c *gin.Context) {
	var upload teacher_check.UploadCheck
	if err := c.ShouldBindJSON(&upload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if upload.Source == nil || *upload.Source == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "source is required"})
		return
	}
	if upload.NeptunHash == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "neptunHash is required"})
		return
	}

	source, err := base64.StdEncoding.DecodeString(*upload.Source)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "source is not valid base64"})
		return
	}
	if len(source) > teacher_check.MaxSourceSize {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "source must not exceed 1 MiB"})
		return
	}
	if err := teacher_check.ValidateZip(source); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "source is not a valid ZIP file"})
		return
	}

	runID := uuid.New()
	md5sum := md5.Sum(source)

	run := db.CGRun{
		GuestUpload: true,
		Source:      source,
		RunID:       &runID,
		SourceMD5:   md5sum[:],
	}

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

	var existingRun db.CGRun
	err = db.DB.
		Session(&gorm.Session{
			Logger: logger.Default.LogMode(logger.Silent),
		}).
		Preload("Student").
		Where(&db.CGRun{SourceMD5: run.SourceMD5}).
		First(&existingRun).
		Error
	if err == nil {
		sum := CGRunCreateReturn{
			RunID:     existingRun.RunID,
			CreatedAt: &existingRun.CreatedAt,
			Student:   students.Student2Return(existingRun.Student),
		}

		c.JSON(http.StatusOK, &sum)
		return
	}

	if err := db.DB.Create(&run).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if err := queue.Send(strconv.FormatUint(uint64(run.ID), 10), 0); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to queue run"})
		return
	}

	db.DB.Where(run.CreatedBy).First(&run.User)

	sum := CGRunCreateReturn{
		RunID:     run.RunID,
		CreatedAt: &run.CreatedAt,
		Student:   students.Student2Return(run.Student),
	}

	c.JSON(http.StatusOK, &sum)
}

func handleRun(c *gin.Context) {
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
		run.CheckResults[i].AttachmentBase64 = teacher_check.BytesToString(result.Attachment)
	}

	c.JSON(http.StatusOK, &run)
}

func handleRunStatus(c *gin.Context) {
	runID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid run UUID"})
		return
	}

	var run teacher_check.CGRunReturnSum
	query := db.DB.Model(&db.CGRun{}).Where(&db.CGRun{RunID: &runID}).First(&run)
	if errors.Is(query.Error, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "run not found"})
		return
	}
	if query.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ret := teacher_check.CGRunStatusReturn{
		CheckTime: run.CheckTime,
	}

	if run.CheckTime != nil {
		ret.Status = "done"
	} else {
		ret.Status = "pending"
	}

	c.JSON(http.StatusOK, &ret)
}
