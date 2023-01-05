package router

import (
	"strings"
)

func safeString(s string) string {
	safe := strings.ReplaceAll(s, "\n", "")
	return strings.ReplaceAll(safe, "\r", "")
}

func requestSourceIp(req *http.Request) (string, error) {
	host, _, err := net.SplitHostPort(req.RemoteAddr)
	if err != nil {
		return "", err
	}

	return host, nil
}
