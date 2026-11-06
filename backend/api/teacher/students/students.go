package students

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	common_api "github.com/kszi2/cg3-server/backend/api/common"
	"github.com/kszi2/cg3-server/backend/db"
	"gorm.io/gorm"
)

type StudentCreate struct {
	NeptunHash string `json:"neptunHash" binding:"required"`
	Initials   string `json:"initials"`
	Notes      string `json:"notes"`
}

type StudentUpdate struct {
	Initials *string `json:"initials"`
	Notes    *string `json:"notes"`
}

type StudentReturn struct {
	ID         uint   `json:"id"`
	NeptunHash string `json:"neptunHash"`
	Initials   string `json:"initials"`
}

type StudentAdminReturn struct {
	StudentReturn

	Notes string `json:"notes"`
}

func Register(router *gin.RouterGroup) {
	router.POST("", handleCreate)
	router.GET("/all", handleAll)
	router.PATCH("/:id", handleUpdate)
	router.DELETE("/:id", handleDelete)
}

func Student2Return(student *db.Student) *StudentReturn {
	if student == nil {
		return nil
	}

	return &StudentReturn{
		ID:         student.ID,
		NeptunHash: student.NeptunHash,
		Initials:   student.Initials,
	}
}

func Student2AdminReturn(student *db.Student) *StudentAdminReturn {
	if student == nil {
		return nil
	}

	return &StudentAdminReturn{
		StudentReturn: *Student2Return(student),
		Notes:         student.Notes,
	}
}

func handleCreate(c *gin.Context) {
	action := common_api.BeginAction(c, "studentManagement")
	defer action.Log()

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

	for _, item := range input {
		if item.NeptunHash == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "neptunHash is required"})
			return
		}
	}

	studentsByHash := make(map[string]*db.Student, len(input))
	mergedNotes := make(map[uint]string)
	newStudents := make([]db.Student, 0, len(input))

	err := db.DB.Transaction(func(tx *gorm.DB) error {
		existing := make([]db.Student, 0, len(input))
		if err := tx.Where("neptun_hash IN ?", hashes(input)).Find(&existing).Error; err != nil {
			return err
		}
		for index := range existing {
			student := &existing[index]
			if _, alreadyFound := studentsByHash[student.NeptunHash]; !alreadyFound {
				studentsByHash[student.NeptunHash] = student
			}
		}

		for _, item := range input {
			student, exists := studentsByHash[item.NeptunHash]
			if !exists {
				student = &db.Student{
					NeptunHash: item.NeptunHash,
					Initials:   item.Initials,
					Notes:      item.Notes,
				}
				newStudents = append(newStudents, *student)
				studentsByHash[item.NeptunHash] = &newStudents[len(newStudents)-1]
				continue
			}

			if student.Initials == item.Initials && item.Notes != "" {
				if student.Notes == "" {
					student.Notes = item.Notes
				} else {
					student.Notes += ", " + item.Notes
				}
				if student.ID != 0 {
					mergedNotes[student.ID] = student.Notes
				}
			}
		}

		if len(newStudents) > 0 {
			if err := tx.Create(&newStudents).Error; err != nil {
				return err
			}
		}

		if len(mergedNotes) > 0 {
			query := strings.Builder{}
			query.WriteString("UPDATE students SET notes = CASE id")
			args := make([]any, 0, len(mergedNotes)*2+len(mergedNotes))
			ids := make([]uint, 0, len(mergedNotes))
			for id, notes := range mergedNotes {
				query.WriteString(" WHEN ? THEN ?")
				args = append(args, id, notes)
				ids = append(ids, id)
			}
			query.WriteString(" END WHERE id IN ?")
			args = append(args, ids)
			if err := tx.Exec(query.String(), args...).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		action.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	response := make([]*StudentAdminReturn, 0, len(input))
	for _, item := range input {
		response = append(response, Student2AdminReturn(studentsByHash[item.NeptunHash]))
	}
	if len(response) > 0 {
		action.StudentID = &response[0].ID
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
	action := common_api.BeginAction(c, "studentManagement")
	defer action.Log()

	ok, _ := common_api.ValidateJWTAdmin(c)
	if !ok {
		return
	}

	var students []db.Student
	if err := db.DB.Select("id", "neptun_hash", "initials", "notes").Order("initials, id").Find(&students).Error; err != nil {
		action.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	response := make([]*StudentAdminReturn, len(students))
	for index := range students {
		response[index] = Student2AdminReturn(&students[index])
	}
	c.JSON(http.StatusOK, response)
}

func handleUpdate(c *gin.Context) {
	action := common_api.BeginAction(c, "studentManagement")
	defer action.Log()

	ok, _ := common_api.ValidateJWTAdmin(c)
	if !ok {
		return
	}

	id, err := strconv.ParseUint(c.Param("id"), 10, 0)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid student ID"})
		return
	}

	var update StudentUpdate
	if err := c.ShouldBindJSON(&update); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var student db.Student
	query := db.DB.First(&student, uint(id))
	if errors.Is(query.Error, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "student not found"})
		return
	}
	if query.Error != nil {
		action.Error(query.Error)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	if update.Initials != nil {
		student.Initials = *update.Initials
	}
	if update.Notes != nil {
		student.Notes = *update.Notes
	}

	if err := db.DB.Save(&student).Error; err != nil {
		action.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	action.StudentID = &student.ID
	c.JSON(http.StatusOK, Student2AdminReturn(&student))
}

func handleDelete(c *gin.Context) {
	action := common_api.BeginAction(c, "studentManagement")
	defer action.Log()

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
		action.Error(query.Error)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if err := db.DB.Delete(&student).Error; err != nil {
		action.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	action.StudentID = &student.ID
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}
