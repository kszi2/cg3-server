package student

import (
	"github.com/gin-gonic/gin"
	"github.com/kszi2/cg3-server/backend/api/student/check"
)

func Register(router *gin.RouterGroup) {
	check.Register(router.Group("/check"))
}
