package students

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	common_api "github.com/kszi2/cg3-server/backend/api/common"
	"github.com/kszi2/cg3-server/backend/db"
	"gorm.io/gorm"
)

type StudentCreate struct {
	NeptunHash string `json:"neptunHash" binding:"required"`
}

type StudentReturn struct {
	ID         uint   `json:"id"`
	NeptunHash string `json:"neptunHash"`
}

func Register(router *gin.RouterGroup) {
	router.POST("", handleCreate)
	router.GET("/all", handleAll)
	router.DELETE("/:id", handleDelete)
}

func Student2Return(student *db.Student) *StudentReturn {
	if student == nil {
		return nil
	}

	return &StudentReturn{
		ID:         student.ID,
		NeptunHash: student.NeptunHash,
	}
}

func handleCreate(c *gin.Context) {
	ok, _ := common_api.ValidateJWTAdmin(c)
	if !ok {
		return
	}

	var input []StudentCreate
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if len(input) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "at least one student is required"})
		return
	}

	students := make([]db.Student, len(input))
	seen := make(map[string]struct{}, len(input))
	for index, item := range input {
		if item.NeptunHash == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "neptunHash is required"})
			return
		}
		if _, exists := seen[item.NeptunHash]; exists {
			c.JSON(http.StatusConflict, gin.H{"error": "duplicate neptunHash in request"})
			return
		}
		seen[item.NeptunHash] = struct{}{}
		students[index] = db.Student{NeptunHash: item.NeptunHash}
	}

	var existing int64
	if err := db.DB.Model(&db.Student{}).Where("neptun_hash IN ?", hashes(input)).Count(&existing).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if existing > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "one or more students already exist"})
		return
	}

	if err := db.DB.Create(&students).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	response := make([]*StudentReturn, len(students))
	for index := range students {
		response[index] = Student2Return(&students[index])
	}
	c.JSON(http.StatusOK, response)
}

func hashes(input []StudentCreate) []string {
	result := make([]string, len(input))
	for index, item := range input {
		result[index] = item.NeptunHash
	}
	return result
}

func handleAll(c *gin.Context) {
	ok, _ := common_api.ValidateJWTAdmin(c)
	if !ok {
		return
	}

	var students []db.Student
	if err := db.DB.Select("id", "neptun_hash").Find(&students).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	response := make([]*StudentReturn, len(students))
	for index := range students {
		response[index] = Student2Return(&students[index])
	}
	c.JSON(http.StatusOK, response)
}

func handleDelete(c *gin.Context) {
	ok, _ := common_api.ValidateJWTAdmin(c)
	if !ok {
		return
	}

	id, err := strconv.ParseUint(c.Param("id"), 10, 0)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid student ID"})
		return
	}

	var student db.Student
	query := db.DB.First(&student, uint(id))
	if errors.Is(query.Error, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "student not found"})
		return
	}
	if query.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if err := db.DB.Delete(&student).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}
