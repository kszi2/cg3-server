package common_api

import (
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v4"
	"github.com/kszi2/cg3-server/backend/db"
	"github.com/kszi2/cg3-server/backend/helper"
)

type JWTClaims struct {
	jwt.RegisteredClaims
	UserID uint `json:"userid"`
	Admin  bool `json:"admin"`
}

var jwtSecret []byte
var jwtExpirationSeconds uint

func Init() {
	jwtSecret = []byte(helper.EnvGet("JWT_SECRET", "Almafa12"))
	exp, err := strconv.Atoi(helper.EnvGet("JWT_EXPIRATION", "1800"))
	if err != nil {
		log.Fatalf("Failed to parse JWT expiration: %v", err)
	}
	jwtExpirationSeconds = uint(exp)
}

func GenerateJWT(user *db.User) (string, error) {
	expTime := time.Now().Add(time.Second * time.Duration(jwtExpirationSeconds))
	claims := &JWTClaims{
		UserID: user.ID,
		Admin:  user.Admin,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expTime),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	return token.SignedString(jwtSecret)
}

func ValidateJWT(c *gin.Context) (bool, *JWTClaims) {
	bearerToken := c.Request.Header.Get("Authorization")
	parts := strings.Split(bearerToken, " ")
	if len(parts) < 2 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid authorization header"})
		return false, nil
	}

	tokenRequest := parts[1]
	var claims JWTClaims

	token, err := jwt.ParseWithClaims(tokenRequest, &claims, func(_ *jwt.Token) (any, error) { return jwtSecret, nil })

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JWT"})
		return false, nil
	}

	if !token.Valid {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JWT"})
		return false, nil
	}

	return true, &claims
}

func ValidateJWTAdmin(c *gin.Context) (bool, *JWTClaims) {
	ok, claims := ValidateJWT(c)
	if !ok {
		return false, claims
	}
	if !claims.Admin {
		c.JSON(http.StatusForbidden, gin.H{"error": "you are not an admin"})
		return false, claims
	}
	return true, claims
}
