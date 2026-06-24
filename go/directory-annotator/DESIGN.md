# Directory Annotator

- This application is a small, self-contained Go program that I use to be able to annotate the files in a directory tree with notes and metadata.

## Requirements

- It should track its data in a sqlite database named `annotations.db`.
- The database should be searched for by walking up the directory tree from the current directory until found.
- It should track files recursively throughout the directory tree.
- File paths should be stored as relative paths from the database location.
- It should never modify any files other than its own sqlite database.
- It should manage the schema of the sqlite database on its own using a version table (and not assume that there will be any external migrations).
- Entries in the sqlite database should be keyed on filename.
- The metadata to store about each file should be: a short text name, a text description, and an updated_at date that tracks the last time the metadata entry was modified (NOT the file's modification date).
- It should present a command-line interface for the user to interact with it.
- It should use the `modernc.org/sqlite` library.

### Metadata lookup

- The user can call the program with the `lookup` argument to access this mode.
- It should take a single additional argument that is a filename.
- When called, it should look up that filename to see if it exists in the sqlite database. If it does exist, it should print the file's metadata to the command line. If it doesn't exist, it should print an error.

### Metadata add/edit

- The user can call the program with the `upsert` argument to access this mode.
- It should take two arguments: the filename and the short text name.
- When called, it should first check if the file exists. If not, it should error.
- If the file does exist, it should prompt the user for a text description. It should do this by invoking an external editor (default to `vim`, configurable via the EDITOR environment variable).
- When all input is gathered, it should update the sqlite database with the new information. If the file already exists in the database, it should modify the existing row. If it does not exist, it should insert it.

### Metadata move

- The user can call the program with the `move` argument.
- It should take two additional arguments: the old filename and the new filename.
- It should simply move an existing entry in the database from an old filename to a new filename. If the old filename does not exist, it should error. If the new filename already exists, it should error.

### Metadata cleanup

- The user can call the program with the `cleanup` argument to access this mode.
- It should take no additional arguments.
- When called, it should compare the database with the state of the directory. If any files exist in the database but not in the directory, it should print those files and prompt the user once for permission to remove all entries.

### List all metadata

- The user can call the program with the `list` argument to access this mode.
- It should take no additional arguments.
- When called, it should display all annotated files in the database with their metadata.

