package main

import (
	"fmt"
	"log"

	"github.com/kszi2/cg3-server/backend/db"
	"github.com/kszi2/cg3-server/backend/queue"
)

func main() {
	err := db.DbConnect()
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

		// TODO: check xd
	}
}
