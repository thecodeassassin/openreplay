package router

func (e *Router) corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Prepare headers for preflight requests
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type,Authorization")
		if r.Method == http.MethodOptions {
			w.Header().Set("Cache-Control", "max-age=86400")
			w.WriteHeader(http.StatusOK)
			return
		}

		log.Printf("Request: %v  -  %v  ", r.Method, safeString(r.URL.Path))

		requestStart := time.Now()

		// Serve request
		next.ServeHTTP(w, r)

		metricsContext, _ := context.WithTimeout(context.Background(), time.Millisecond*100)
		e.totalRequests.Add(metricsContext, 1)
		e.requestDuration.Record(metricsContext,
			float64(time.Now().Sub(requestStart).Milliseconds()),
			[]attribute.KeyValue{attribute.String("method", r.URL.Path)}...,
		)
	})
}

func (e *Router) filterIPMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Prepare headers for preflight requests

		log.Printf("Request: %v  -  %v  ", r.Method, util.SafeString(r.URL.Path))

		requestStart := time.Now()

		// Serve request
		next.ServeHTTP(w, r)

		metricsContext, _ := context.WithTimeout(context.Background(), time.Millisecond*100)
		e.totalRequests.Add(metricsContext, 1)
		e.requestDuration.Record(metricsContext,
			float64(time.Now().Sub(requestStart).Milliseconds()),
			[]attribute.KeyValue{attribute.String("method", r.URL.Path)}...,
		)
	})
}
