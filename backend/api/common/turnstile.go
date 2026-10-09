package common_api

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/kszi2/cg3-server/backend/helper"
)

var turnstileSiteKey string
var turnstileSiteSecret string

func InitTurnstile() {
	turnstileSiteKey = helper.EnvGet("TURNSTILE_SITE_KEY", "disabled")
	turnstileSiteSecret = helper.EnvGet("TURNSTILE_SITE_SECRET", "")
}

func GetTurnstileSiteKey() string {
	return turnstileSiteKey
}

func ValidateTurnstile(token *string) bool {
	if turnstileSiteSecret == "" || turnstileSiteKey == "disabled" {
		return true
	}
	if token == nil || *token == "" {
		return false
	}

	form := url.Values{}
	form.Set("secret", turnstileSiteSecret)
	form.Set("response", *token)

	request, err := http.NewRequest(
		http.MethodPost,
		"https://challenges.cloudflare.com/turnstile/v0/siteverify",
		strings.NewReader(form.Encode()),
	)
	if err != nil {
		return false
	}
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{Timeout: time.Second}
	response, err := client.Do(request)
	if err != nil {
		return false
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		return false
	}

	var result struct {
		Success bool `json:"success"`
	}
	if err := json.NewDecoder(response.Body).Decode(&result); err != nil {
		return false
	}
	return result.Success
}
