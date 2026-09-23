package main

import (
	"log"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/kszi2/cg3-server/backend/api"
	"github.com/kszi2/cg3-server/backend/db"
	"github.com/kszi2/cg3-server/backend/helper"
	"github.com/kszi2/cg3-server/backend/queue"
)

func main() {
	err := db.DbConnect(true)
	if err != nil {
		log.Fatal(err)
	}

	err = queue.Connect()
	defer queue.Disconnect()
	if err != nil {
		log.Fatal(err)
	}

	frontendDir := helper.EnvGet("FRONTEND_DIR", "../frontend/dist")

	router := gin.Default()

	api.Register(router.Group("/api"))

	router.Static("/assets", frontendDir+"/assets")
	router.StaticFile("/favicon.svg", frontendDir+"/favicon.svg")

	router.NoRoute(func(c *gin.Context) {
		if strings.HasPrefix(c.Request.URL.Path, "/api/") {
			c.JSON(404, gin.H{"error": "API route not found"})
			return
		}

		c.File(frontendDir + "/index.html")
	})

	addr := helper.EnvGet("SERVER_ADDRESS", "0.0.0.0:8080")

	router.Run(addr)
}
