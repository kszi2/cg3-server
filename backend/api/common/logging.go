package common_api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/netip"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kszi2/cg3-server/backend/db"
)

const userIDContextKey = "userID"

type actionResponseWriter struct {
	gin.ResponseWriter
	body bytes.Buffer
}

func (w *actionResponseWriter) Write(body []byte) (int, error) {
	w.body.Write(body)
	return w.ResponseWriter.Write(body)
}

func (w *actionResponseWriter) WriteString(body string) (int, error) {
	w.body.WriteString(body)
	return w.ResponseWriter.WriteString(body)
}

type Action struct {
	context   *gin.Context
	category  string
	writer    *actionResponseWriter
	err       error
	UserID    *uint
	RunID     *uint
	StudentID *uint
}

func BeginAction(c *gin.Context, category string) *Action {
	writer := &actionResponseWriter{ResponseWriter: c.Writer}
	c.Writer = writer
	action := &Action{context: c, category: category, writer: writer}
	if userID, exists := c.Get(userIDContextKey); exists {
		if id, ok := userID.(uint); ok {
			action.UserID = &id
		}
	}
	return action
}

func (a *Action) Error(err error) {
	a.err = err
}

func (a *Action) Log() {
	if a.UserID == nil {
		if userID, exists := a.context.Get(userIDContextKey); exists {
			if id, ok := userID.(uint); ok {
				a.UserID = &id
			}
		}
	}

	status := a.writer.Status()
	logEntry := db.Log{
		Type:       a.category,
		Time:       time.Now(),
		UserID:     a.UserID,
		CGRunID:    a.RunID,
		StudentID:  a.StudentID,
		Endpoint:   stringPointer(a.context.FullPath()),
		Method:     stringPointer(a.context.Request.Method),
		StatusCode: new(uint(status)),
		Details:    responseDetails(status, a.writer.body.Bytes(), a.err),
	}

	if ip, err := netip.ParseAddr(a.context.ClientIP()); err == nil {
		logEntry.IP = &ip
	}
	if err := db.DB.Create(&logEntry).Error; err != nil {
		log.Printf("Failed to save action log: %v", err)
	}
}

func responseDetails(status int, body []byte, actionErr error) string {
	if status < http.StatusBadRequest {
		return ""
	}
	if actionErr != nil {
		return fmt.Sprintf("request failed with HTTP status %d: %v", status, actionErr)
	}
	if len(body) == 0 {
		return fmt.Sprintf("request failed with HTTP status %d", status)
	}

	var value any
	if err := json.Unmarshal(body, &value); err == nil {
		serialized, err := json.Marshal(value)
		if err == nil {
			return fmt.Sprintf("request failed with HTTP status %d: %s", status, serialized)
		}
	}
	return fmt.Sprintf("request failed with HTTP status %d: %s", status, strings.TrimSpace(string(body)))
}

func stringPointer(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}

func ParseTrustedProxies(value string) ([]string, error) {
	if strings.TrimSpace(value) == "" {
		return nil, nil
	}

	proxies := strings.Split(value, ",")
	result := make([]string, 0, len(proxies))
	for _, proxy := range proxies {
		proxy = strings.TrimSpace(proxy)
		if proxy == "" {
			continue
		}
		if ip := net.ParseIP(proxy); ip != nil {
			result = append(result, ip.String())
			continue
		}
		if _, _, err := net.ParseCIDR(proxy); err != nil {
			return nil, err
		}
		result = append(result, proxy)
	}
	return result, nil
}
