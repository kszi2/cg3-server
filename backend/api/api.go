package api

import (
	"github.com/gin-gonic/gin"
	common_api "github.com/kszi2/cg3-server/backend/api/common"
	"github.com/kszi2/cg3-server/backend/api/student"
	"github.com/kszi2/cg3-server/backend/api/teacher"
)

func Register(router *gin.RouterGroup) {
	common_api.Init()
	teacher.Register(router.Group("/teacher"))
	student.Register(router.Group("/student"))
}
