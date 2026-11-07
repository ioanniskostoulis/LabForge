{
  "targets": [{
    "target_name": "win-input-source",
    "sources": ["win-input-source.c"],
    "libraries": ["user32.lib"],
    "win_delay_load_hook": "true"
  }]
}
