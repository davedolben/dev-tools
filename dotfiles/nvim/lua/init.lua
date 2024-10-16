-- disable netrw at the very start of your init.lua
vim.g.loaded_netrw = 1
vim.g.loaded_netrwPlugin = 1

-- optionally enable 24-bit colour
vim.opt.termguicolors = true

-- empty setup using defaults
require("nvim-tree").setup()

-- Load the fzf extension for telescope
require('telescope').setup{
  fzf = {
    fuzzy = true
  }
}
require('telescope').load_extension('fzf');

local lspconfig = require('lspconfig')
lspconfig.ts_ls.setup{}
lspconfig.gopls.setup{}

-- Mapping for the copilot plugin
vim.keymap.set('i', '<C-Space>', '<Plug>(copilot-suggest)')
vim.keymap.set('n', 'gr', '<cmd> lua vim.lsp.buf.references() <cr>')

