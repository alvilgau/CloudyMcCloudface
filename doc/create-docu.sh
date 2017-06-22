pandoc -V geometry:margin=1in -V documentclass=report --number-sections --toc-depth=2 -V secnumdepth=1 --toc doc.md --latex-engine=/Library/TeX/texbin/xelatex -o doc.pdf

