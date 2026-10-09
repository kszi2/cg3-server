package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	common_api "github.com/kszi2/cg3-server/backend/api/common"
	"github.com/kszi2/cg3-server/backend/api/student"
	"github.com/kszi2/cg3-server/backend/api/teacher"
)

type TurnstileReturn struct {
	Enabled bool    `json:"enabled"`
	SiteKey *string `json:"siteKey"`
}

func Register(router *gin.RouterGroup) {
	common_api.InitJWT()
	common_api.InitTurnstile()
	teacher.Register(router.Group("/teacher"))
	student.Register(router.Group("/student"))
	router.GET("/turnstile", handleTurnstile)
}

func handleTurnstile(c *gin.Context) {
	siteKey := common_api.GetTurnstileSiteKey()

	if siteKey == "disabled" {
		c.JSON(http.StatusOK, &TurnstileReturn{
			Enabled: false,
		})
	} else {
		c.JSON(http.StatusOK, &TurnstileReturn{
			Enabled: true,
			SiteKey: &siteKey,
		})
	}
}
