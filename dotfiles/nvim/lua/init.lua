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

-- These are equivalent to require('lspconfig').ts_ls.setup{}
vim.lsp.config('ts_ls', {})
vim.lsp.config('gopls', {})

-- Disable LSP syntax highlighting for now, since it does some weird stuff with
-- type imports in typescript.
-- TODO: could probably filter this down to only typescript files, but :shrug:
vim.api.nvim_create_autocmd("LspAttach", {
  callback = function(args)
    local client = vim.lsp.get_client_by_id(args.data.client_id)
    client.server_capabilities.semanticTokensProvider = nil
  end,
});

-- Mapping for the copilot plugin
vim.keymap.set('i', '<C-Space>', '<Plug>(copilot-suggest)')
vim.keymap.set('n', 'gr', '<cmd> lua vim.lsp.buf.references() <cr>')

