package helper

import (
	"log"
	"os"
	"strings"
)

func EnvGet(key string, def string) string {
	prod, _ := os.LookupEnv("PROD")

	val, ok := os.LookupEnv(key)

	if !ok {
		if strings.ToLower(prod) == "true" || prod == "1" {
			log.Fatalf("Env variable '%v' not set in production.", key)
		}
		return def
	}

	return val
}
