package queue

import (
	"context"
	"fmt"
	"time"

	"github.com/kszi2/cg3-server/backend/helper"
	amqp "github.com/rabbitmq/amqp091-go"
)

var ch *amqp.Channel
var conn *amqp.Connection
var q *amqp.Queue

func Connect() error {
	user := helper.EnvGet("RABBITMQ_USER", "rabbit")
	pass := helper.EnvGet("RABBITMQ_PASS", "rabbit")
	host := helper.EnvGet("RABBITMQ_HOST", "localhost")
	port := helper.EnvGet("RABBITMQ_PORT", "5672")

	queueName := helper.EnvGet("RABBITMQ_QUEUE", "image")

	connection, err := amqp.Dial(fmt.Sprintf("amqp://%v:%v@%v:%v/", user, pass, host, port))
	if err != nil {
		return err
	}

	channel, err := connection.Channel()
	if err != nil {
		connection.Close()
		return err
	}

	queue, err := channel.QueueDeclare(
		queueName, // name
		true,      // durability
		false,     // delete when unused
		false,     // exclusive
		false,     // no-wait
		amqp.Table{
			amqp.QueueTypeArg: amqp.QueueTypeQuorum,
		},
	)
	if err != nil {
		channel.Close()
		connection.Close()
		return err
	}

	ch = channel
	conn = connection
	q = &queue

	return nil
}

func Disconnect() {
	q = nil
	ch.Close()
	ch = nil
	conn.Close()
	conn = nil
}

func Send(id string) error {
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()

	err := ch.PublishWithContext(ctx,
		"",     // exchange
		q.Name, // routing key
		false,  // mandatory
		false,  // immediate
		amqp.Publishing{
			ContentType: "text/plain",
			Body:        []byte(id),
		})

	return err
}

func GetConsumer() (<-chan amqp.Delivery, error) {
	msgs, err := ch.Consume(
		q.Name, // queue
		"",     // consumer
		true,   // auto-ack
		false,  // exclusive
		false,  // no-local
		false,  // no-wait
		nil,    // args
	)

	return msgs, err
}
