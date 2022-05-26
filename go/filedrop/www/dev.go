// +build dev

package www

import (
  "net/http"
)

var Assets = http.Dir("./resources/www")

