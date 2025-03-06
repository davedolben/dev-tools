package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

func main() {
	// Define command line flags
	bucketName := flag.String("bucket", "", "S3 bucket name")
	filePath := flag.String("file", "", "Path to local file to upload")
	s3Path := flag.String("s3path", "", "Destination path in S3 bucket")
	region := flag.String("region", "us-east-1", "AWS region")
	flag.Parse()

	// Validate required flags
	if *bucketName == "" || *filePath == "" || *s3Path == "" {
		fmt.Println("Error: bucket, file, and s3path are required")
		flag.Usage()
		os.Exit(1)
	}

	// Check if file exists
	file, err := os.Open(*filePath)
	if err != nil {
		log.Fatalf("Failed to open file: %v", err)
	}
	defer file.Close()

	// Get file info for content length
	fileInfo, err := file.Stat()
	if err != nil {
		log.Fatalf("Failed to get file info: %v", err)
	}

	// Load AWS configuration
	cfg, err := config.LoadDefaultConfig(context.TODO(),
		config.WithRegion(*region),
	)
	if err != nil {
		log.Fatalf("Failed to load AWS config: %v", err)
	}

	// Create S3 client
	client := s3.NewFromConfig(cfg)

	// Upload the file
	_, err = client.PutObject(context.TODO(), &s3.PutObjectInput{
		Bucket:        bucketName,
		Key:           s3Path,
		Body:          file,
		ContentLength: aws.Int64(fileInfo.Size()),
	})
	if err != nil {
		log.Fatalf("Failed to upload file: %v", err)
	}

	fmt.Printf("Successfully uploaded %s to s3://%s/%s\n", *filePath, *bucketName, *s3Path)
}
