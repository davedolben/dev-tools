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

  char* args[] = {
#include "child_args.inl"
    NULL
  };
  ChildProcessConfig config = {};
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

