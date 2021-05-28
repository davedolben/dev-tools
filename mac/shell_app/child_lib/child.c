#include "child.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

#define CHECK(exp) if (!(exp)) { fprintf(stderr, "CHECK failed: " #exp "\n"); exit(1); }

void timeString(char* buf, size_t len) {
  CHECK(buf != NULL);
  time_t now;
  time(&now);

  struct tm* local_time = localtime(&now);

  snprintf(buf, len, "%4d-%02d-%02d %02d:%02d:%02d",
    local_time->tm_year + 1900,
    local_time->tm_mon + 1,
    local_time->tm_mday,
    local_time->tm_hour,
    local_time->tm_min,
    local_time->tm_sec);
}

void RunAndMonitorChildProcess(char* const* args, const ChildProcessConfig* config) {
  CHECK(config != NULL);

  // Create a pipe
  int ctop_pipe[2];
  CHECK(pipe(ctop_pipe) >= 0);

  // Fork the process
  pid_t p = fork();
  CHECK(p >= 0);

  const char* outfilename = config->stdout_file;
  if (outfilename == NULL || strlen(outfilename) == 0) {
    outfilename = "stdout.txt";
  }
  const char* errfilename = config->stderr_file;
  if (errfilename == NULL || strlen(errfilename) == 0) {
    errfilename = "stderr.txt";
  }

  if (p > 0) {
    // Parent process

    // Close writing side
    close(ctop_pipe[1]);

    // Open output file
    FILE* outfile = fopen(outfilename, "w");
    FILE* errfile = fopen(errfilename, "w");

    printf("===== Starting child =====\n");
    // Read from child
    // TODO: figure out how to read in parallel from stderr
    char buf[101];
    while (1) {
      int n = read(ctop_pipe[0], buf, sizeof(buf)-1);
      if (n <= 0) {
        break;
      }
      // Add a null terminator
      buf[n] = '\0';
      printf("%s", buf);
      fprintf(outfile, "%s", buf);
    }

    // Wait for the child process to die
    wait(NULL);

    close(ctop_pipe[0]);
    fclose(outfile);
    fclose(errfile);

    printf("===== Ending child =====\n");
  } else {
    // Child process

    // Close reading side
    close(ctop_pipe[0]);

    char time_buf[1024];
    timeString(time_buf, sizeof(time_buf));
    char buf[1024];
    snprintf(buf, sizeof(buf), "[%s] Running subcommand\n", time_buf);
    write(ctop_pipe[1], buf, strlen(buf)+1);

    dup2(ctop_pipe[1], STDOUT_FILENO);
    close(ctop_pipe[1]);

    //char* args[] = {"./test.sh", NULL};
    execvp(args[0], args);

    fprintf(stderr, "Failed to run child\n");
    exit(1);
  }
}

