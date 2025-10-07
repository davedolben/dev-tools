filetype on

syntax on
colorscheme desert

set number
set relativenumber

set colorcolumn=100

" Install plugins first
" Open (n)vim and run :PlugInstall
call plug#begin()
Plug 'nvim-lua/plenary.nvim'
Plug 'nvim-telescope/telescope.nvim', { 'tag': '0.1.8' }
Plug 'nvim-telescope/telescope-fzf-native.nvim', { 'do': 'make' }
Plug 'neovim/nvim-lspconfig'
Plug 'nvim-tree/nvim-tree.lua'
Plug 'christoomey/vim-tmux-navigator'
call plug#end()

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

set scrolloff=3

" Put new windows below the current window
set splitbelow
" Put new windows right of the current window
set splitright
" Turn off mouse support
set mouse = ""

" Move up and down naturally through wrapped lines
map j gj
map k gk

map <leader>p :Telescope find_files <Enter>
map <C-p> :Telescope find_files <Enter>
nmap <leader>ff :Telescope find_files <Enter>
nmap <leader>fg :Telescope live_grep <Enter>
nmap <leader>. <cmd>lua vim.lsp.buf.code_action() <Enter>
nmap <leader>? <cmd>lua vim.diagnostic.open_float()<Enter>
nmap <leader>r <cmd>lua vim.lsp.buf.rename()<Enter>

" TODO: key mapping for listing functions in a file. Also should work 'method'
" into it
" lua require('telescope.builtin').lsp_document_symbols({ symbols='function' })
" TODO: key mapping for Hightouch formatting:
" npx prettier --write %
" NODE_OPTIONS=--max-old-space-size=8192 npx eslint --fix packages/backend/lib/idr/v2/e2e-tests/long-merge-chain.test.ts

nmap QQ :q <Enter>

" https://github.com/christoomey/vim-tmux-navigator
let g:tmux_navigator_no_mappings = 1
nnoremap <silent> <C-h> :<C-U>TmuxNavigateLeft<cr>
nnoremap <silent> <C-j> :<C-U>TmuxNavigateDown<cr>
nnoremap <silent> <C-k> :<C-U>TmuxNavigateUp<cr>
nnoremap <silent> <C-l> :<C-U>TmuxNavigateRight<cr>

