from pathlib import Path
text = Path("materiales.html").read_text(encoding="utf-8")
start = text.find("<script>")
end = text.find("</script>", start)
if start == -1 or end == -1:
    raise SystemExit("script tag not found")
script_content = text[start + len("<script>\n"):end]
Path("_check.js").write_text(script_content, encoding="utf-8")
