package teacher

import (
	"github.com/gin-gonic/gin"
	"github.com/kszi2/cg3-server/backend/api/teacher/check"
	"github.com/kszi2/cg3-server/backend/api/teacher/students"
	"github.com/kszi2/cg3-server/backend/api/teacher/user"
)

func Register(router *gin.RouterGroup) {
	user.Register(router.Group("/user"))
	check.Register(router.Group("/check"))
	students.Register(router.Group("/students"))
}
