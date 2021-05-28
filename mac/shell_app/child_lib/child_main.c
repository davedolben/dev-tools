#include <stdlib.h>

#include "child.h"

int main(void) {
  char* args[] = {"./test.sh", NULL};
  ChildProcessConfig config = {};
  config.stdout_file = "tmp_stdout.txt";
  config.stderr_file = "tmp_stderr.txt";
  RunAndMonitorChildProcess(args, &config);
}

