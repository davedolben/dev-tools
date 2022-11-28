package data

import (
	"encoding/json"
	"errors"
	"io"
	"os"
)

type BlobStore interface {
	Get(key string) (string, error)
	Set(key string, data string) error
}

type FileBlobStore struct {
	filename string
	blobs map[string]string
}

var KeyNotFoundError = errors.New("key not found")

func NewFileBlobStore(filename string) (BlobStore, error) {
  f, err := os.Open(filename)
  if err != nil && !os.IsNotExist(err) {
    return nil, err
  }

  bs := &FileBlobStore{
    filename: filename,
		blobs: make(map[string]string),
  }

  if err == nil {
    defer f.Close()
    bytes, readErr := io.ReadAll(f)
    if readErr != nil {
      return nil, readErr
    }
    data := struct{
			Blobs map[string]string
		}{
			Blobs: make(map[string]string),
		}
    if parseErr := json.Unmarshal(bytes, &data); parseErr != nil {
      return nil, parseErr
    }
		bs.blobs = data.Blobs
  }

	return bs, nil
}

func (bs *FileBlobStore) Get(key string) (string, error) {
	data, ok := bs.blobs[key]
	if !ok {
		return "", KeyNotFoundError
	}
	return data, nil
}

func (bs *FileBlobStore) Set(key string, data string) error {
	bs.blobs[key] = data
	return bs.Flush()
}

func (bs *FileBlobStore) Flush() error {
	data := struct{
		Blobs map[string]string
	}{
		Blobs: bs.blobs,
	}
  byts, err := json.Marshal(&data)
  if err != nil {
    return err
  }
  if err := os.WriteFile(bs.filename, byts, 0644); err != nil {
    return err
  }
  return nil
}
