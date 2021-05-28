#ifndef CHILD_H_
#define CHILD_H_

typedef struct {
  const char* stdout_file;
  const char* stderr_file;
} ChildProcessConfig;

// Note that args must end with a NULL
void RunAndMonitorChildProcess(char* const* args, const ChildProcessConfig* config);

#endif  // CHILD_H_

