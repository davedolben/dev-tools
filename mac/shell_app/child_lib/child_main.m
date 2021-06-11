#include <Cocoa/Cocoa.h>

#include "child.h"

@interface AppDelegate : NSObject <NSApplicationDelegate>
@end

@implementation AppDelegate
- (void)applicationWillFinishLaunching:(NSNotification*)notification {
  NSMenu* menuBar;
  NSMenu* appMenu;
  NSMenuItem* appMenuItem;
  NSMenuItem* quitMenuItem;

  menuBar = [NSMenu new];
  appMenuItem = [NSMenuItem new];
  [menuBar addItem:appMenuItem];
  appMenu = [NSMenu new];
  quitMenuItem = [[NSMenuItem alloc] initWithTitle:@"Quit" action:@selector(terminate:) keyEquivalent:@"q"];
  [appMenu addItem:quitMenuItem];
  [appMenuItem setSubmenu:appMenu];
  [NSApp setMainMenu:menuBar];
}

- (void) applicationDidFinishLaunching: (NSNotification*) notification {
  NSLog(@"I'm done launching!");

  // Create a temp directory for log files.
  BOOL isDir;
  NSFileManager* fileManager = [NSFileManager defaultManager]; 
  NSString* directory = @"/tmp/dev.ddolben/logs";
  if (![fileManager fileExistsAtPath:directory isDirectory:&isDir]) {
    if (![fileManager createDirectoryAtPath:directory withIntermediateDirectories:YES attributes:nil error:NULL]) {
      NSLog(@"Error: Create folder failed %@", directory);
      return;
    }
  }

  char* args[] = {
#include "child_args.inl"
    NULL
  };

  // Grab the app bundle's path
  NSURL* appDir = [[NSBundle mainBundle] bundleURL];
  char rootDirBuf[4096];
  [[appDir path] getCString:rootDirBuf maxLength:sizeof(rootDirBuf)-1 encoding:NSASCIIStringEncoding];
  NSLog(@"%@", appDir.path);
  printf("%s\n", rootDirBuf);

  // Append the child binary's name to the app bundle path
  char childBin[4096];
  snprintf(childBin, sizeof(childBin)-1, "%s/Contents/MacOS/%s", rootDirBuf, args[0]);
  args[0] = childBin;
  printf("%s\n", childBin);

  ChildProcessConfig config = {};
  config.stdout_file = "/tmp/dev.ddolben/logs/stdout.txt";
  config.stderr_file = "/tmp/dev.ddolben/logs/stderr.txt";
  RunAndMonitorChildProcess(args, &config);
  //[self terminate: nil];
}
@end

int main(int argc, char* argv[]) {
  @autoreleasepool {
    NSApplication* app = [NSApplication sharedApplication];
    AppDelegate* delegate = [AppDelegate new];
    [app setDelegate:delegate];
    [app run];
  }
  return 0;
}

