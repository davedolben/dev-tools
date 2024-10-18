filetype on

syntax on
colorscheme desert

set number
set relativenumber

set colorcolumn=100

" Requires the file from lua/init.lua, which loads / configures a bunch of plugins
lua require("init")

" \t char == 2 columns
set tabstop=2
" A level of indentation is 2 columns
set shiftwidth=2
" Expand tabs into spaces when you press Tab
set expandtab
" Turn on autoindent
set autoindent
" Set autoindent to be a bit smarter (what does this do exactly?)
set smartindent

" Enable incremental search
set incsearch
" Highlight search matches
set hlsearch
" Case-insensitive search by default
set ignorecase

" Make backspace work as expected in insert mode in non-MacOS default Vim installations
set backspace=indent,eol,start

" Move up and down naturally through wrapped lines
map j gj
map k gk

map <leader>p :Telescope find_files <Enter>
map <C-p> :Telescope find_files <Enter>
nmap <leader>ff :Telescope find_files <Enter>
nmap <leader>fg :Telescope live_grep <Enter>
nmap <leader>. <cmd>lua vim.lsp.buf.code_action() <Enter>

nmap QQ :q <Enter>

