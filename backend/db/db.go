package db

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/kszi2/cg3-server/backend/helper"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

type User struct {
	gorm.Model

	Username string `gorm:"unique"`
	Password string `gorm:"not null"`

	DisplayName string `gorm:"not null"`

	Admin bool `gorm:"default:false"`

	Runs []CGRun `gorm:"foreignKey:CreatedBy"`
}

type CGRun struct {
	gorm.Model

	GuestUpload bool   `gorm:"not null"`
	Source      []byte `gorm:"not null"`
	SourceMD5   []byte `gorm:"index"`

	RunID *uuid.UUID `gorm:"unique;not null"`

	CreatedBy *uint
	User      *User `gorm:"foreignKey:CreatedBy"`

	StudentID *uint
	Student   *Student `gorm:"foreignKey:StudentID"`

	CheckResults []CheckResult `gorm:"foreignKey:RunID"`
	CheckTime    *time.Time
}

type CheckResult struct {
	gorm.Model

	Check          string `gorm:"not null"`
	Result         int    `gorm:"not null"`
	Notes          *string
	Attachment     []byte
	AttachmentType *string

	RunID uint `gorm:"not null"`
}

type Student struct {
	gorm.Model

	NeptunHash string `gorm:"not null"`

	Runs []CGRun `gorm:"foreignKey:StudentID"`
}

func DbConnect(migrate bool) error {
	host := helper.EnvGet("DB_HOST", "localhost")
	user := helper.EnvGet("DB_USER", "gorm")
	pass := helper.EnvGet("DB_PASS", "gorm")
	name := helper.EnvGet("DB_NAME", "gorm")
	port := helper.EnvGet("DB_PORT", "5432")

	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=Europe/Budapest", host, user, pass, name, port)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{TranslateError: true})
	if err != nil {
		return err
	}

	DB = db

	if !migrate {
		return err
	}

	models := []any{&User{}, &CGRun{}, &CheckResult{}, &Student{}}

	for _, model := range models {
		err = DB.AutoMigrate(model)
		if err != nil {
			return err
		}
	}

	storageQueries := []string{
		`ALTER TABLE cg_runs ALTER COLUMN source SET STORAGE EXTERNAL`,
		`ALTER TABLE check_results ALTER COLUMN attachment SET STORAGE EXTERNAL`,
	}

	for _, query := range storageQueries {
		err := DB.Exec(query).Error
		if err != nil {
			return err
		}
	}

	return err
}
