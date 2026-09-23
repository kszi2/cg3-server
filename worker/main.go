package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/kszi2/cg3-server/backend/db"
	"github.com/kszi2/cg3-server/backend/queue"
	"github.com/kszi2/cg3-server/checker/check"
)

func main() {
	err := db.DbConnect(false)
	if err != nil {
		log.Fatal(err)
	}

	err = queue.Connect()
	defer queue.Disconnect()
	if err != nil {
		log.Fatal(err)
	}

	msgs, err := queue.GetConsumer()
	if err != nil {
		log.Fatal(err)
	}

	for d := range msgs {
		id := uint(0)
		fmt.Sscanf(string(d.Body), "%d", &id)

		ctx, cancel := context.WithTimeout(context.Background(), time.Second*120)
		log.Printf("running check for %v", id)
		err = check.Run(ctx, id)
		log.Printf("done")
		cancel()

		if err != nil {
			log.Printf("error: %v", err)
		}
	}
}
