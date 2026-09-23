package queue

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/kszi2/cg3-server/backend/helper"
	amqp "github.com/rabbitmq/amqp091-go"
)

const reconnectDelay = time.Second

var (
	stateMu   sync.RWMutex
	connectMu sync.Mutex
	ch        *amqp.Channel
	conn      *amqp.Connection
	q         *amqp.Queue
	stopped   bool
	done      chan struct{}
)

func Connect() error {
	stateMu.Lock()
	if done == nil {
		done = make(chan struct{})
	}
	stopped = false
	stateMu.Unlock()

	return reconnect()
}

func Disconnect() {
	stateMu.Lock()
	if stopped {
		stateMu.Unlock()
		return
	}
	stopped = true
	if done != nil {
		close(done)
		done = nil
	}
	oldChannel := ch
	oldConnection := conn
	ch = nil
	conn = nil
	q = nil
	stateMu.Unlock()

	if oldChannel != nil {
		_ = oldChannel.Close()
	}
	if oldConnection != nil {
		_ = oldConnection.Close()
	}
}

func Send(id string, priority uint8) error {
	publish := func() error {
		channel, queue, err := current()
		if err != nil {
			return err
		}

		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		return channel.PublishWithContext(ctx, "", queue.Name, false, false, amqp.Publishing{
			ContentType: "text/plain",
			Body:        []byte(id),
			Priority:    priority,
		})
	}

	if err := publish(); err == nil {
		return nil
	} else if reconnectErr := reconnect(); reconnectErr != nil {
		return reconnectErr
	}
	return publish()
}

func GetConsumer() (<-chan amqp.Delivery, error) {
	if _, _, err := current(); err != nil {
		if err := reconnect(); err != nil {
			return nil, err
		}
	}

	output := make(chan amqp.Delivery)
	go consume(output)
	return output, nil
}

func consume(output chan<- amqp.Delivery) {
	defer close(output)

	for {
		channel, queue, err := current()
		if err != nil {
			if !waitForReconnect() {
				return
			}
			continue
		}

		messages, err := channel.Consume(queue.Name, "", true, false, false, false, nil)
		if err != nil {
			if !waitForReconnect() {
				return
			}
			continue
		}

		for message := range messages {
			select {
			case output <- message:
			case <-shutdown():
				return
			}
		}

		if isStopped() {
			return
		}
		if reconnect() != nil && !waitForReconnect() {
			return
		}
	}
}

func reconnect() error {
	connectMu.Lock()
	defer connectMu.Unlock()

	if isStopped() {
		return fmt.Errorf("queue is disconnected")
	}

	user := helper.EnvGet("RABBITMQ_USER", "rabbit")
	pass := helper.EnvGet("RABBITMQ_PASS", "rabbit")
	host := helper.EnvGet("RABBITMQ_HOST", "localhost")
	port := helper.EnvGet("RABBITMQ_PORT", "5672")
	queueName := helper.EnvGet("RABBITMQ_QUEUE", "check")

	connection, err := amqp.Dial(fmt.Sprintf("amqp://%v:%v@%v:%v/", user, pass, host, port))
	if err != nil {
		return err
	}

	channel, err := connection.Channel()
	if err != nil {
		_ = connection.Close()
		return err
	}

	queue, err := channel.QueueDeclare(queueName, true, false, false, false, amqp.Table{
		amqp.QueueTypeArg: amqp.QueueTypeQuorum,
	})
	if err != nil {
		_ = channel.Close()
		_ = connection.Close()
		return err
	}

	stateMu.Lock()
	if stopped {
		stateMu.Unlock()
		_ = channel.Close()
		_ = connection.Close()
		return fmt.Errorf("queue is disconnected")
	}
	oldConnection := conn
	ch = channel
	conn = connection
	q = &queue
	currentDone := done
	stateMu.Unlock()

	if oldConnection != nil {
		_ = oldConnection.Close()
	}
	go monitor(connection, currentDone)
	return nil
}

func monitor(connection *amqp.Connection, connectionDone <-chan struct{}) {
	closed := connection.NotifyClose(make(chan *amqp.Error, 1))
	select {
	case <-closed:
		for {
			if isStopped() {
				return
			}
			if _, _, err := current(); err == nil {
				return
			}
			if reconnect() == nil {
				return
			}
			if !waitForReconnect() {
				return
			}
		}
	case <-connectionDone:
	}
}

func current() (*amqp.Channel, *amqp.Queue, error) {
	stateMu.RLock()
	defer stateMu.RUnlock()
	if stopped || ch == nil || conn == nil || q == nil || conn.IsClosed() {
		return nil, nil, fmt.Errorf("queue is not connected")
	}
	return ch, q, nil
}

func waitForReconnect() bool {
	stateMu.RLock()
	doneChannel := done
	stateMu.RUnlock()
	if doneChannel == nil {
		return false
	}

	timer := time.NewTimer(reconnectDelay)
	defer timer.Stop()
	select {
	case <-timer.C:
		if _, _, err := current(); err != nil {
			_ = reconnect()
		}
		return !isStopped()
	case <-doneChannel:
		return false
	}
}

func shutdown() <-chan struct{} {
	stateMu.RLock()
	defer stateMu.RUnlock()
	if done == nil {
		closed := make(chan struct{})
		close(closed)
		return closed
	}
	return done
}

func isStopped() bool {
	stateMu.RLock()
	defer stateMu.RUnlock()
	return stopped
}
