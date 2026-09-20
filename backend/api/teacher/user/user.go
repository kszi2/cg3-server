package user

import (
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-crypt/crypt"
	"github.com/go-crypt/crypt/algorithm/argon2"
	common_api "github.com/kszi2/cg3-server/backend/api/common"
	"github.com/kszi2/cg3-server/backend/db"
	"gorm.io/gorm"
)

var hasher *argon2.Hasher
var decoder *crypt.Decoder

type UserLogin struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type UserCreate struct {
	UserLogin

	DisplayName string `json:"displayname"`
	Admin       bool   `json:"admin"`
}

type UserModify struct {
	Password    *string `json:"password"`
	DisplayName *string `json:"displayname"`
	Admin       *bool   `json:"admin"`
}

type UserReturn struct {
	Username    string    `json:"username"`
	ID          uint      `json:"id"`
	DisplayName string    `json:"displayname"`
	CreatedAt   time.Time `json:"registered"`
	Admin       bool      `json:"admin"`
}

type UserReturnWithToken struct {
	UserReturn

	Token string `json:"token"`
}

func User2Return(user *db.User) *UserReturn {
	if user == nil {
		return nil
	}

	return &UserReturn{
		Username:    user.Username,
		DisplayName: user.DisplayName,
		CreatedAt:   user.CreatedAt,
		Admin:       user.Admin,
		ID:          user.ID,
	}
}

func Register(router *gin.RouterGroup) {
	h, err := argon2.New(argon2.WithProfileRFC9106LowMemory())
	if err != nil {
		log.Fatal(err)
	}
	hasher = h

	d, err := crypt.NewDefaultDecoder()
	if err != nil {
		log.Fatal(err)
	}
	decoder = d

	router.POST("/create", handleCreate)
	router.POST("/login", handleLogin)
	router.GET("/me", handleMe)
	router.PATCH("/:id", handleModify)
	router.GET("/all", handleAll)
}

func handleCreate(c *gin.Context) {
	var register UserCreate

	err := c.ShouldBindBodyWithJSON(&register)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ok, claims := common_api.ValidateJWT(c)
	if !ok {
		return
	}
	if !claims.Admin {
		c.JSON(http.StatusForbidden, gin.H{"error": "you are not an admin"})
		return
	}

	digest, err := hasher.Hash(register.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	user := db.User{
		Username:    register.Username,
		DisplayName: register.DisplayName,
		Admin:       register.Admin,
		Password:    digest.String(),
	}

	res := db.DB.Create(&user)
	if res.Error != nil {
		if errors.Is(res.Error, gorm.ErrDuplicatedKey) {
			c.JSON(http.StatusConflict, gin.H{"error": "username already used"})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	c.JSON(http.StatusOK, User2Return(&user))
}

func handleLogin(c *gin.Context) {
	var login UserLogin

	err := c.ShouldBindBodyWithJSON(&login)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user db.User

	res := db.DB.Where(&db.User{Username: login.Username}).First(&user)
	if res.Error != nil {
		if errors.Is(res.Error, gorm.ErrRecordNotFound) {
			log.Printf("User not found.")
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid username or password"})
			return
		}

		log.Printf("DB error: %v", res.Error)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	if res.RowsAffected != 1 {
		log.Printf("User not found.")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid username or password"})
		return
	}

	digest, err := decoder.Decode(user.Password)
	if err != nil {
		log.Printf("Password decode error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	if !digest.Match(login.Password) {
		log.Printf("Password does not match for user %v", login.Username)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid username or password"})
		return
	}

	token, err := common_api.GenerateJWT(&user)
	if err != nil {
		log.Printf("JWT generate error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	c.JSON(http.StatusOK, UserReturnWithToken{
		UserReturn: *User2Return(&user),
		Token:      token,
	})
}

func handleMe(c *gin.Context) {
	ok, claims := common_api.ValidateJWT(c)
	if !ok {
		return
	}

	var user db.User

	res := db.DB.Where(claims.UserID).First(&user)
	if res.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	c.JSON(http.StatusOK, User2Return(&user))
}

func handleModify(c *gin.Context) {
	var modify UserModify

	err := c.ShouldBindBodyWithJSON(&modify)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ok, claims := common_api.ValidateJWT(c)
	if !ok {
		return
	}
	if !claims.Admin {
		c.JSON(http.StatusForbidden, gin.H{"error": "you are not an admin"})
		return
	}

	var user db.User
	id := c.Param("id")

	res := db.DB.Where(id).First(&user)
	if res.Error != nil {
		if errors.Is(res.Error, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	if modify.DisplayName != nil {
		user.DisplayName = *modify.DisplayName
	}

	if modify.Admin != nil {
		user.Admin = *modify.Admin
	}

	if modify.Password != nil {
		digest, err := hasher.Hash(*modify.Password)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
			return
		}

		user.Password = digest.String()
	}

	if err := db.DB.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	c.JSON(http.StatusOK, User2Return(&user))
}

func handleAll(c *gin.Context) {
	ok, claims := common_api.ValidateJWT(c)
	if !ok {
		return
	}
	if !claims.Admin {
		c.JSON(http.StatusForbidden, gin.H{"error": "you are not an admin"})
		return
	}

	var users []db.User
	res := db.DB.Find(&users)
	if res.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	var returnUsers []*UserReturn

	for _, user := range users {
		returnUsers = append(returnUsers, User2Return(&user))
	}

	c.JSON(http.StatusOK, returnUsers)
}
