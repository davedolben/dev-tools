#!/usr/bin/env sh

script_dir="$(cd $(dirname "$0") && pwd)"
bin_dir="${OUT_DIR:-go-bin}"
bin_dir="${script_dir}/${bin_dir}"

mkdir -p "$bin_dir"

cd "${script_dir}/go"

# Add these as environment variables to turn on features
DO_MAC=
DO_ARM=
while [ "$#" -gt "0" ]; do
  case "$1" in
    "--macos")
      DO_MAC=true
      shift
      ;;
    "--arm")
      DO_ARM=true
      shift
      ;;
    *)
      echo "Unrecognized argument: $1"
      exit 1
      ;;
  esac
done

build() {
  cd "$1"
  go build -o "${bin_dir}/$2"
  cd -
}

if [ ! -z "$DO_MAC" ]; then
  echo "Cross-compiling for macos"
  export GOOS=darwin
  export GOARCH=amd64
fi

# Do this next to make sure it overrides the previous value
if [ ! -z "$DO_ARM" ]; then
  echo "Cross-compiling for arm"
  export GOARCH=arm64
fi

if [ ! -z "$GOOS" ]; then
  bin_dir="${bin_dir}/${GOOS}-${GOARCH}"
fi

build fileserver fileserver
build babysitter babysitter
build notes notes-server
build captains_chair captains-chair

(
  # Clear the environment variables (just in this subshell) so we can execute the codegen step
  # on the local system regardless of the target architecture we're compiling to.
  export GOOS=
  export GOARCH=
  cd filedrop
  ./codegen.sh
  cd -
)

build filedrop filedrop
