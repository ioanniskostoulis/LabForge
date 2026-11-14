% Licensed under the GNU General Public License v2 or later. See LICENSE.
% ============================================================
% labforge.cls: the LabForge report class
% ============================================================
% One file that a project keeps next to main.tex. The project builds with
% XeLaTeX or LuaLaTeX through latexmk, with or without the LabForge app.
%
%   \documentclass[preset=report, language=greek, bibliography]{.labforge}
%
% Every block command has the same form, \my<thing>[keys]{content}, and the
% same key names:
%
%   \myfigure[label=, caption=, width=, height=, place=]{file in graphics/}
%   \myplot    [label=, caption=, width=, height=, place=]{file in plots/}
%            several files, comma-separated, are set side by side
%   \mytable   [label=, caption=, width=, spread=, place=]{file in tables/}
%   \myformula [label=, place=]{math}        each top-level row numbered
%   \myequation[place=]{math}                unnumbered
%   \myreaction[label=, place=]{chemistry}   numbered R1, R2, ...
%            rows split by \\ are aligned math with \ce{...}, one number
%   \mysection [label=]{title}               also \mysubsection, \mysubsubsection
%
%   label    reference name; graphics, plots and tables default to the file name
%   caption  caption text; a figure, plot or table without one has no number
%   subcaption  for several files, one text each: (a) text, (b) text
%   width    a length (8cm) or a fraction of the column (0.5)
%   height   a length
%   place    here (default) or span, across all columns
%   caption-align  justify, center, left or right, for this caption only
%   hyphenate      true or false, hyphenation inside this caption
%
% \myref{name} prints "Figure 3", "Equation 2.1" or "Section II" in the
% document language; \myref{a, b} prints "Figures 3 and 4"; \myref*{name}
% prints only the number. A multi-row \myformula[label=x] generates x[1],
% x[2], ...; \myref{x} names the full group in the plural. Every indexed
% reference is a link to its own row in the PDF. Side-by-side figures with
% label=x give x[1], x[2], ...: \myref{x[2]} prints "Figure 3b".
% \ref{a, b} gives the linked bare numbers joined in the document language.
%
% Layout settings go in \labforgesetup{...} in the preamble of main.tex.
% All vertical space is counted in whole lines, so lines stay on one grid:
% the lines of neighbouring columns align and their last lines match.
% ============================================================
\NeedsTeXFormat{LaTeX2e}[2022-06-01]
\ProvidesClass{.labforge}[2026-10-16 v3.0.0 LabForge report class]


% ========================================
% CLASS OPTIONS
% ========================================
\newif\iflf@bibliography
\def\lf@preset{default}
\def\lf@language{greek}
\def\lf@fontsize{10pt}
\def\lf@greek{greek}
\DeclareKeys[labforge]
  {
    preset.store         = \lf@preset,
    language.store       = \lf@language,
    fontsize.store       = \lf@fontsize,
    bibliography.if      = lf@bibliography,
  }
\ProcessKeyOptions[labforge]

\edef\lf@load{\noexpand\LoadClass[a4paper,\lf@fontsize]{extarticle}}
\lf@load

\ifdefined\XeTeXrevision\else\ifdefined\directlua\else
  \ClassError{labforge}{Build this report with XeLaTeX or LuaLaTeX}
    {LabForge reports use OpenType fonts. Run latexmk -xelatex main.tex.}
\fi\fi


% ========================================
% PACKAGES
% ========================================
\RequirePackage{geometry}
\RequirePackage{fontspec}
\RequirePackage{polyglossia}
\RequirePackage[protrusion=true, expansion=false]{microtype}
\RequirePackage[nodisplayskipstretch]{setspace}
\RequirePackage{xcolor}
\RequirePackage{graphicx}
\RequirePackage{multicol}
\RequirePackage{enumitem}
\RequirePackage{fancyhdr}
% Footnotes sit at the foot of the page even though pages are not stretched.
\RequirePackage[bottom]{footmisc}
\RequirePackage{amsmath}
\RequirePackage{unicode-math}
\RequirePackage{siunitx}
\sisetup{group-digits=none, uncertainty-mode=separate}
\DeclareSIUnit{\atm}{atm}
\DeclareSIUnit{\mmHg}{mmHg}
\DeclareSIUnit{\torr}{Torr}
\RequirePackage[version=4]{mhchem}
\RequirePackage{chemfig}
\RequirePackage{pgfplots}
\pgfplotsset{compat=1.18}
\usetikzlibrary{calc}
\iflf@bibliography
  \RequirePackage[backend=biber, style=numeric, sorting=none]{biblatex}
  \IfFileExists{references.bib}{\addbibresource{references.bib}}{\addbibresource{data/references.bib}}
  % A key that is not in the .bib file prints ?? in bold, like an undefined \ref, instead of the key itself.
  \protected\def\abx@missing#1{\mbox{\reset@font\bfseries ??}}
\fi

\graphicspath{{graphics/}{plots/}}


% ========================================
% FONTS AND LANGUAGE
% ========================================
% Libertinus for text and mathematics (a free serif face with Greek) and
% DejaVu Sans Mono for code: all three ship with every TeX distribution and
% are loaded by file name, so a report looks the same on any computer. main-font, math-font and mono-font
% in \labforgesetup choose installed fonts instead.
\setmainfont{LibertinusSerif}[
    Extension      = .otf,
    UprightFont    = *-Regular,
    BoldFont       = *-Bold,
    ItalicFont     = *-Italic,
    BoldItalicFont = *-BoldItalic,
]
\setmonofont{DejaVuSansMono}[
    Extension      = .ttf,
    UprightFont    = *,
    BoldFont       = *-Bold,
    ItalicFont     = *-Oblique,
    BoldItalicFont = *-BoldOblique,
]
\newfontfamily\greekfonttt{DejaVuSansMono}[
    Extension      = .ttf,
    UprightFont    = *,
    BoldFont       = *-Bold,
    ItalicFont     = *-Oblique,
    BoldItalicFont = *-BoldOblique,
]
\setmathfont{LibertinusMath-Regular.otf}[math-style = TeX]

\ExplSyntaxOn
\str_case:VnF \lf@language
  {
    { greek }   { \setmainlanguage { greek }   \setotherlanguage { english } }
    { english } { \setmainlanguage { english } \setotherlanguage { greek } }
  }
  {
    \ClassError { labforge } { Unknown~language~"\lf@language" }
      { Use~language=greek~or~language=english. }
  }
\ExplSyntaxOff


% ========================================
% TYPOGRAPHY
% ========================================
% Hyphenation tuned for narrow columns: skip the no-hyphen pass, prefer a
% hyphen over loose spacing, and keep emergency stretch as the last resort.
\pretolerance=-1
\tolerance=800
\emergencystretch=1.5ex
\hyphenpenalty=30
\doublehyphendemerits=5000
\finalhyphendemerits=2500
% Loose lines in narrow columns are unavoidable with long Greek words.
\hbadness=10000
% At least two lines of a paragraph stay together across a break.
\clubpenalty=1000
\widowpenalty=1000

% Pages and columns end where their lines end; nothing is stretched.
\raggedbottom
\raggedcolumns
\setlength{\multicolsep}{0pt}
\setlength{\columnseprule}{0pt}
% multicol resets the paragraph tolerances at every column start.
\multicoltolerance=1500
\multicolpretolerance=-1
\apptocmd{\prepare@multicols}{\hbadness=10000}
    {}{\ClassWarning{labforge}{Could not patch \string\prepare@multicols}}
\renewcommand{\setemergencystretch}[2]{\emergencystretch=3ex}

% Page number centred, a quarter of the way into the bottom margin.
\pagestyle{fancy}
\fancyhf{}
\fancyfoot[C]{\footnotesize\addfontfeature{Numbers = OldStyle}\thepage}
\renewcommand{\headrulewidth}{0pt}
\AtBeginDocument{%
    \setlength{\headwidth}{\textwidth}%
    \setlength{\footskip}{0.25\dimexpr
        \paperheight - 1in - \voffset - \topmargin
        - \headheight - \headsep - \textheight\relax}%
}

\newcommand{\mytoday}{\two@digits\day.\two@digits\month.\number\year}


\ExplSyntaxOn

% ========================================
% SETTINGS
% ========================================
\dim_new:N  \g_lf_line_dim        % one line: the grid unit
\dim_new:N  \l_lf_plot_tick_dim
\dim_new:N  \l_lf_sub_figure_gap_dim
\tl_new:N   \l_lf_plot_grid_tl
\tl_new:N   \l_lf_plot_colors_tl
\dim_new:N  \l_lf_indent_dim
\tl_new:N   \l_lf_caption_align_tl
\tl_new:N   \l_lf_caption_align_figure_tl
\tl_new:N   \l_lf_caption_align_plot_tl
\tl_new:N   \l_lf_caption_align_table_tl
\tl_new:N   \l_lf_caption_kind_tl
\tl_new:N   \l_lf_snap_tl
\tl_new:N   \l_lf_caption_use_tl
\bool_new:N \l_lf_caption_hyphenate_bool
\tl_new:N   \l_lf_effective_left_tl
\tl_new:N   \l_lf_effective_right_tl
\tl_new:N   \l_lf_effective_top_tl
\tl_new:N   \l_lf_effective_bottom_tl

\msg_new:nnn { labforge } { old-key }
  { #1~is~no~longer~used:~block-snap~sets~the~space~around~blocks.~Remove~#1~from~\iow_char:N \\labforgesetup. }
\keys_define:nn { labforge / setup }
  {
    margin          .tl_set:N   = \l_lf_margin_tl,
    margin-left     .tl_set:N   = \l_lf_margin_left_tl,
    margin-right    .tl_set:N   = \l_lf_margin_right_tl,
    margin-top      .tl_set:N   = \l_lf_margin_top_tl,
    margin-bottom   .tl_set:N   = \l_lf_margin_bottom_tl,
    line-spread     .tl_set:N   = \l_lf_spread_tl,
    indent          .tl_set:N   = \l_lf_indent_tl,
    paragraph-space .int_set:N  = \l_lf_paragraph_space_int,
    block-space     .int_set:N  = \l_lf_block_space_int,
    block-gap       .int_set:N  = \l_lf_block_gap_int,
    math-space      .int_set:N  = \l_lf_math_space_int,
    sub-figure-gap  .dim_set:N  = \l_lf_sub_figure_gap_dim,
    caption-gap     .tl_set:N   = \l_lf_caption_gap_tl,
    subcaption-gap  .tl_set:N   = \l_lf_subcaption_gap_tl,
    caption-spread  .tl_set:N   = \l_lf_caption_spread_tl,
    math-gap        .tl_set:N   = \l_lf_math_gap_tl,
    fit-to-grid     .code:n     = { \msg_warning:nnn { labforge } { old-key } { fit-to-grid } },
    table-after     .code:n     = { \msg_warning:nnn { labforge } { old-key } { table-after } },
    block-snap      .choices:nn = { auto, line, half, off }
                                  { \tl_set_eq:NN \l_lf_snap_tl \l_keys_choice_tl },
    section-numbers .bool_set:N = \l_lf_section_numbers_bool,
    section-hang    .bool_set:N = \l_lf_section_hang_bool,
    section-center  .bool_set:N = \l_lf_section_center_bool,
    number-depth    .int_set:N  = \l_lf_number_depth_int,
    caption-align   .choices:nn = { justify, center, left, right }
                                  { \tl_set_eq:NN \l_lf_caption_align_tl \l_keys_choice_tl },
    figure-caption-align .choices:nn = { justify, center, left, right }
                                  { \tl_set_eq:NN \l_lf_caption_align_figure_tl \l_keys_choice_tl },
    plot-caption-align .choices:nn = { justify, center, left, right }
                                  { \tl_set_eq:NN \l_lf_caption_align_plot_tl \l_keys_choice_tl },
    table-caption-align .choices:nn = { justify, center, left, right }
                                  { \tl_set_eq:NN \l_lf_caption_align_table_tl \l_keys_choice_tl },
    caption-hyphenate .bool_set:N = \l_lf_caption_hyphenate_bool,
    caption-color   .tl_set:N   = \l_lf_caption_color_tl,
    caption-theme   .bool_set:N = \l_lf_caption_theme_bool,
    theme-color     .tl_set:N   = \l_lf_theme_color_tl,
    plot-line-width .tl_set:N   = \l_lf_plot_line_tl,
    plot-axis-width .tl_set:N   = \l_lf_plot_axis_tl,
    plot-tick-length .dim_set:N = \l_lf_plot_tick_dim,
    plot-minor-ticks .int_set:N = \l_lf_plot_minor_int,
    plot-padding    .tl_set:N   = \l_lf_plot_padding_tl,
    plot-balance    .tl_set:N   = \l_lf_plot_balance_tl,
    plot-mark-size  .tl_set:N   = \l_lf_plot_mark_tl,
    plot-grid       .choices:nn = { none, major, both }
                                  { \tl_set_eq:NN \l_lf_plot_grid_tl \l_keys_choice_tl },
    plot-colors     .choices:nn = { black, color }
                                  { \tl_set_eq:NN \l_lf_plot_colors_tl \l_keys_choice_tl },
    plot-legend     .tl_set:N   = \l_lf_plot_legend_tl,
    main-font       .tl_set:N   = \l_lf_main_font_tl,
    math-font       .tl_set:N   = \l_lf_math_font_tl,
    mono-font       .tl_set:N   = \l_lf_mono_font_tl,
  }

\NewDocumentCommand \labforgesetup { m } { \keys_set:nn { labforge / setup } {#1} }
\@onlypreamble \labforgesetup

% The class owns the baseline. .settings.tex lists named styles, each with
% only its changes from the baseline. A matching style is applied as the file
% is read, so a later \labforgesetup in that file or in main.tex still wins.
\labforgesetup
  {
    margin = 1in, line-spread = 1.5, indent = 0.5in,
    margin-left = , margin-right = , margin-top = , margin-bottom = ,
    paragraph-space = 0, block-space = 0, block-gap = 0, math-space = 0, sub-figure-gap = 1.5em,
    caption-gap = 0.35, subcaption-gap = 0.25, caption-spread = 0.75, block-snap = auto, math-gap = 0.25,
    section-numbers = true, section-hang = true, section-center = false,
    number-depth = 2,
    caption-align = justify, caption-hyphenate = true, caption-color = black, caption-theme = false,
    theme-color = 061027,
    plot-line-width = 0.8pt, plot-axis-width = 0.5pt, plot-tick-length = 4pt,
    plot-minor-ticks = 1, plot-padding = 0.06, plot-balance = 0.5,
    plot-mark-size = 2pt, plot-grid = none, plot-colors = black,
    plot-legend = north~west,
    main-font = , math-font = , mono-font = ,
  }
\bool_new:N \l_lf_preset_found_bool
\str_if_eq:eeT { \lf@preset } { default } { \bool_set_true:N \l_lf_preset_found_bool }
\str_if_eq:eeT { \lf@preset } { none } { \def\lf@preset{default} \bool_set_true:N \l_lf_preset_found_bool }
\NewDocumentCommand \labforgepreset { m m }
  {
    \str_if_eq:eeT { \tl_trim_spaces:n {#1} } { \lf@preset }
      { \bool_set_true:N \l_lf_preset_found_bool \labforgesetup {#2} }
  }
\@onlypreamble \labforgepreset

% Read style definitions with ordinary catcodes, as in a preamble.
\ExplSyntaxOff
\IfFileExists{.settings.tex}{\input{.settings.tex}}{\IfFileExists{settings.tex}{\input{settings.tex}}{}}
\ExplSyntaxOn
\bool_if:NF \l_lf_preset_found_bool
  {
    \ClassError { labforge } { Unknown~preset~"\lf@preset" }
      { Define~it~with~\string\labforgepreset\{\lf@preset\}\{...\}~in~.settings.tex. }
  }

% Applied at the end of the preamble, so a project's own
% settings win over the preset.
\cs_new_protected:Npn \lf_apply_setup:
  {
    \use:e { \exp_not:N \definecolor { lfTheme } { HTML } { \exp_not:V \l_lf_theme_color_tl } }
    \tl_if_empty:NF \l_lf_main_font_tl { \setmainfont { \l_lf_main_font_tl } }
    \tl_if_empty:NF \l_lf_math_font_tl { \setmathfont { \l_lf_math_font_tl } [ math-style = TeX ] }
    \tl_if_empty:NF \l_lf_mono_font_tl
      {
        \setmonofont { \l_lf_mono_font_tl }
        \renewfontfamily \greekfonttt { \l_lf_mono_font_tl }
      }
    \setstretch { \l_lf_spread_tl }
    \normalsize
    \dim_gset:Nn \g_lf_line_dim { \baselineskip }
    \dim_set:Nn \l_lf_indent_dim { \l_lf_indent_tl }
    \setlength \topskip { \g_lf_line_dim }
    \setlength \parindent { \l_lf_indent_dim }
    \setlength \parskip { \l_lf_paragraph_space_int \g_lf_line_dim }
    \setlength \columnsep { \l_lf_indent_dim }
    \tl_set_eq:NN \l_lf_effective_left_tl \l_lf_margin_tl
    \tl_set_eq:NN \l_lf_effective_right_tl \l_lf_margin_tl
    \tl_set_eq:NN \l_lf_effective_top_tl \l_lf_margin_tl
    \tl_set_eq:NN \l_lf_effective_bottom_tl \l_lf_margin_tl
    \tl_if_blank:VF \l_lf_margin_left_tl { \tl_set_eq:NN \l_lf_effective_left_tl \l_lf_margin_left_tl }
    \tl_if_blank:VF \l_lf_margin_right_tl { \tl_set_eq:NN \l_lf_effective_right_tl \l_lf_margin_right_tl }
    \tl_if_blank:VF \l_lf_margin_top_tl { \tl_set_eq:NN \l_lf_effective_top_tl \l_lf_margin_top_tl }
    \tl_if_blank:VF \l_lf_margin_bottom_tl { \tl_set_eq:NN \l_lf_effective_bottom_tl \l_lf_margin_bottom_tl }
    % The text block holds a whole number of lines, so every column ends on
    % a line and the last lines of neighbouring columns match.
    \int_set:Nn \l_tmpa_int
      {
        \fp_eval:n
          {
            floor
              (
                \dim_to_fp:n { \paperheight - ( \l_lf_effective_top_tl ) - ( \l_lf_effective_bottom_tl ) }
                / \dim_to_fp:n { \g_lf_line_dim }
              )
          }
      }
    \use:e
      {
        \exp_not:N \geometry
          {
            left = \l_lf_effective_left_tl , right = \l_lf_effective_right_tl , top = \l_lf_effective_top_tl ,
            textheight = \dim_eval:n { \l_tmpa_int \g_lf_line_dim } ,
          }
      }
    \setlist [ enumerate ]
      {
        leftmargin = \l_lf_indent_dim, labelindent = 0pt,
        labelwidth = 0.6\l_lf_indent_dim, labelsep = 0.4\l_lf_indent_dim,
        itemsep = 0pt, topsep = 0pt, partopsep = 0pt, parsep = 0pt,
        label = \roman*., align = left
      }
    \setlist [ itemize ]
      {
        leftmargin = \l_lf_indent_dim, labelindent = 0pt,
        labelwidth = 0.6\l_lf_indent_dim, labelsep = 0.4\l_lf_indent_dim,
        itemsep = 0pt, topsep = 0pt, partopsep = 0pt, parsep = 0pt,
        label = \textbullet, align = left
      }
    \lf_apply_plots:
    \setlist [ description ]
      {
        leftmargin = \l_lf_indent_dim, labelindent = 0pt,
        labelwidth = 0.6\l_lf_indent_dim, labelsep = 0.4\l_lf_indent_dim,
        itemsep = 0pt, topsep = 0pt, partopsep = 0pt, parsep = 0pt,
        align = left
      }
  }

\hook_gput_code:nnn { begindocument / before } { labforge }
  {
    \lf_apply_setup:
    \RequirePackage [ hidelinks, hypertexnames = false, unicode, bookmarksnumbered ] { hyperref }
  }


% ========================================
% LANGUAGE STRINGS
% ========================================
\prop_const_from_keyval:Nn \c_lf_text_english_prop
  {
    figure     = Figure,
    figures    = Figures,
    table      = Table,
    tables     = Tables,
    equation   = Equation,
    equations  = Equations,
    reaction   = Reaction,
    reactions  = Reactions,
    section    = Section,
    sections   = Sections,
    and        = and,
    to         = to,
    conducted  = Date~of~experiment:,
    submitted  = Date~of~submission:,
    supervisor = Supervisor:,
    references = REFERENCES,
  }
\prop_const_from_keyval:Nn \c_lf_text_greek_prop
  {
    figure     = Σχήμα,
    figures    = Σχήματα,
    table      = Πίνακας,
    table.acc  = Πίνακα,
    tables     = Πίνακες,
    equation   = Σχέση,
    equations  = Σχέσεις,
    reaction   = Αντίδραση,
    reactions  = Αντιδράσεις,
    section    = Ενότητα,
    sections   = Ενότητες,
    and        = και,
    to         = έως,
    conducted  = Ημερομηνία~διεξαγωγής~της~άσκησης:,
    submitted  = Ημερομηνία~παράδοσης~της~αναφοράς:,
    supervisor = Επιβλέπων:,
    references = ΒΙΒΛΙΟΓΡΑΦΙΑ,
  }
\prop_new:N \g_lf_text_prop
\prop_gset_eq:Nc \g_lf_text_prop { c_lf_text_ \lf@language _prop }
\cs_new:Npn \lf_text:n #1 { \prop_item:Nn \g_lf_text_prop {#1} }
\cs_generate_variant:Nn \lf_text:n { e }

% A range reads "2 to 4 m" in English and "2 έως 4 m" in Greek: one unit after the range.
\sisetup { range-phrase = { ~ \lf_text:n { to } ~ }, range-units = single }


% ========================================
% NUMBERING
% ========================================
% number-depth: 1 gives n, 2 gives S.n, 3 gives S.SS.n, 4 gives S.SS.SSS.n,
% with the trailing parts left out before their level has started.
\cs_new:Npn \lf_number:n #1
  {
    \int_compare:nNnTF { \l_lf_number_depth_int } = { 1 }
      { \arabic {#1} }
      {
        \int_compare:nNnTF { \value { section } } = { 0 }
          { \arabic {#1} }
          {
            \arabic { section }
            \int_compare:nNnT { \l_lf_number_depth_int } > { 2 }
              {
                \int_compare:nNnT { \value { subsection } } > { 0 }
                  {
                    . \arabic { subsection }
                    \int_compare:nNnT { \l_lf_number_depth_int } > { 3 }
                      {
                        \int_compare:nNnT { \value { subsubsection } } > { 0 }
                          { . \arabic { subsubsection } }
                      }
                  }
              }
            . \arabic {#1}
          }
      }
  }
\newcounter { lfreaction }
\cs_set:Npn \theequation    { \lf_number:n { equation } }
\cs_set:Npn \thefigure      { \lf_number:n { figure } }
\cs_set:Npn \thetable       { \lf_number:n { table } }
\cs_set:Npn \thelfreaction  { R \lf_number:n { lfreaction } }
\cs_set:Npn \thesection       { \Roman { section } }
\cs_set:Npn \thesubsection    { \thesection . \Roman { subsection } }
\cs_set:Npn \thesubsubsection { \thesubsection . \Roman { subsubsection } }

\cs_new_protected:Npn \lf_reset_numbers:
  {
    \setcounter { equation } { 0 }
    \setcounter { figure } { 0 }
    \setcounter { table } { 0 }
    \setcounter { lfreaction } { 0 }
  }


% ========================================
% REFERENCES
% ========================================
% Each label also records its kind in the .aux file, so \myref knows whether
% to print "Figure", "Table", "Equation", "Reaction" or "Section".
\cs_new_protected:Npn \lf@reftype #1#2 { \cs_gset:cpn { lf@type@#1 } {#2} }
% A section label also records its title, so a lone \myref names the section.
\cs_new_protected:Npn \lf@reftitle #1#2 { \cs_gset:cpn { lf@title@#1 } {#2} }
\bool_new:N \l_lf_ref_title_bool

\cs_new_protected:Npn \lf_label:nn #1#2
  {
    \label {#1}
    \protected@write \@auxout { } { \string \lf@reftype { #1 } { #2 } }
  }
\cs_generate_variant:Nn \lf_label:nn { V }

% The name of a kind in a grammatical case: "table.acc" when the language
% has that form, otherwise "table". Greek uses the accusative by default
% ("στον Πίνακα 1"); \myref[nom] gives the nominative ("ο Πίνακας 1").
\tl_new:N \l_lf_ref_case_tl
\cs_new:Npn \lf_name:n #1
  {
    \prop_if_in:NeTF \g_lf_text_prop { #1 . \l_lf_ref_case_tl }
      { \prop_item:Ne \g_lf_text_prop { #1 . \l_lf_ref_case_tl } }
      { \prop_item:Ne \g_lf_text_prop {#1} }
  }
\cs_generate_variant:Nn \prop_if_in:NnTF { Ne }
\cs_generate_variant:Nn \prop_item:Nn { Ne }
\cs_generate_variant:Nn \lf_name:n { e }

\seq_new:N \l_lf_ref_seq
\seq_new:N \l_lf_ref_out_seq
\seq_new:N \l_lf_ref_expanded_seq
\tl_new:N  \l_lf_ref_type_tl
\bool_new:N \l_lf_ref_same_bool

% A formula label names the whole numbered group. Its indexed names identify
% individual rows; the group size is restored from the .aux file on the next run.
\cs_new_protected:Npn \lf@formula@group #1#2
  { \cs_gset:cpn { lf@formula@count@#1 } {#2} }

\cs_new_protected:Npn \lf_ref_expand_formula_groups:
  {
    \seq_clear:N \l_lf_ref_expanded_seq
    \seq_map_inline:Nn \l_lf_ref_seq
      {
        \cs_if_exist:cTF { lf@formula@count@##1 }
          {
            \int_step_inline:nn { \use:c { lf@formula@count@##1 } }
              { \seq_put_right:Nn \l_lf_ref_expanded_seq { ##1 [ ####1 ] } }
          }
          { \seq_put_right:Nn \l_lf_ref_expanded_seq {##1} }
      }
    \seq_set_eq:NN \l_lf_ref_seq \l_lf_ref_expanded_seq
  }

% Stored as the base label's reference text, so ordinary \ref{base} prints
% the same list of numbers. \myref{base} uses the indexed labels for links.
\cs_new_protected:Npn \lf_formula_numbers:nn #1#2
  {
    \seq_clear:N \l_lf_ref_out_seq
    \int_step_inline:nn {#2}
      { \seq_put_right:Nn \l_lf_ref_out_seq { \ref* { #1 [ ##1 ] } } }
    \seq_use:Nnnn \l_lf_ref_out_seq
      { ~ \lf_text:n { and } ~ } { ,~ } { ~ \lf_text:n { and } ~ }
  }
\cs_new_eq:NN \lf@formula@numbers \lf_formula_numbers:nn

% Reference numbers are plain text; the displayed equation tag may still
% have parentheses, but prose references use "Equation 1" and "Reaction R1".
\cs_new_protected:Npn \lf_ref_number:nn #1#2
  { \ref* {#2} }

\cs_new_protected:Npn \lf_ref_one:nn #1#2   % #1 true when only the number is wanted
  {
    \cs_if_exist:cTF { lf@type@#2 }
      {
        \tl_set:Nv \l_lf_ref_type_tl { lf@type@#2 }
        \hyperref [{#2}]
          {
            \bool_if:nF {#1} { \mbox { \lf_name:e { \l_lf_ref_type_tl } } \nobreakspace }
            \lf_ref_number:Vn \l_lf_ref_type_tl {#2}
            \bool_lazy_and:nnT { \l_lf_ref_title_bool } { ! #1 }
              {
                \str_if_eq:VnT \l_lf_ref_type_tl { section }
                  { \cs_if_exist:cT { lf@title@#2 } { \c_space_tl \use:c { lf@title@#2 } } }
              }
          }
      }
      { \ref {#2} }
  }
\cs_generate_variant:Nn \lf_ref_number:nn { V }

\msg_new:nnn { labforge } { ref-case }
  { \iow_char:N \\myref~takes~[nom]~or~[acc],~not~[#1]. }

\NewDocumentCommand \myref { s O{ acc } m }
  {
    \str_case:nnF {#2}
      {
        { acc } { \tl_set:Nn \l_lf_ref_case_tl { acc } }
        { nom } { \tl_set:Nn \l_lf_ref_case_tl { nom } }
      }
      {
        \msg_warning:nnn { labforge } { ref-case } {#2}
        \tl_set:Nn \l_lf_ref_case_tl { acc }
      }
    \lf_ref_list:nn {#1} {#3}
  }

\cs_new_protected:Npn \lf_ref_list:nn #1#2
  {
    \seq_set_from_clist:Nn \l_lf_ref_seq {#2}
    \lf_ref_expand_formula_groups:
    \int_compare:nNnTF { \seq_count:N \l_lf_ref_seq } = { 1 }
      {
        \group_begin:
          \bool_set_true:N \l_lf_ref_title_bool
          \lf_ref_one:nn {#1} { \seq_item:Nn \l_lf_ref_seq { 1 } }
        \group_end:
      }
      {
        % One kind for all: "Figures 2, 3 and 5". Mixed kinds: each named.
        \bool_set_true:N \l_lf_ref_same_bool
        \tl_clear:N \l_lf_ref_type_tl
        \seq_map_inline:Nn \l_lf_ref_seq
          {
            \cs_if_exist:cTF { lf@type@##1 }
              {
                \tl_if_empty:NTF \l_lf_ref_type_tl
                  { \tl_set:Nv \l_lf_ref_type_tl { lf@type@##1 } }
                  {
                    \str_if_eq:eeF { \use:c { lf@type@##1 } } { \l_lf_ref_type_tl }
                      { \bool_set_false:N \l_lf_ref_same_bool }
                  }
              }
              { \bool_set_false:N \l_lf_ref_same_bool }
          }
        \seq_clear:N \l_lf_ref_out_seq
        \bool_if:NTF \l_lf_ref_same_bool
          {
            \bool_if:NF #1 { \mbox { \lf_name:e { \l_lf_ref_type_tl s } } \nobreakspace }
            \seq_map_inline:Nn \l_lf_ref_seq
              {
                \seq_put_right:Nn \l_lf_ref_out_seq
                  { \hyperref [{##1}] { \lf_ref_number:Vn \l_lf_ref_type_tl {##1} } }
              }
          }
          {
            \seq_map_inline:Nn \l_lf_ref_seq
              { \seq_put_right:Nn \l_lf_ref_out_seq { \lf_ref_one:nn {#1} {##1} } }
          }
        \seq_use:Nnnn \l_lf_ref_out_seq
          { ~ \lf_text:n { and } ~ } { ,~ } { ~ \lf_text:n { and } ~ }
      }
  }

% Keep LaTeX's public \ref dispatcher and its starred form. At document start
% hyperref supplies \T@ref for normal references; patch only that lookup.
\cs_new_eq:NN \lf_single_ref:n \@kernel@ref
\seq_new:N \l_lf_number_ref_seq
\seq_new:N \l_lf_number_ref_out_seq
\cs_new_protected:Npn \lf_ref_numbers:n #1
  {
    \seq_set_from_clist:Nn \l_lf_number_ref_seq {#1}
    \seq_clear:N \l_lf_number_ref_out_seq
    \seq_map_inline:Nn \l_lf_number_ref_seq
      { \seq_put_right:Nn \l_lf_number_ref_out_seq { \lf_single_ref:n {##1} } }
    \seq_use:Nnnn \l_lf_number_ref_out_seq
      { ~ \lf_text:n { and } ~ } { ,~ } { ~ \lf_text:n { and } ~ }
  }
\cs_new_protected:Npn \lf_ref_dispatch:n #1
  {
    \tl_if_in:nnTF {#1} {,}
      { \lf_ref_numbers:n {#1} }
      { \lf_single_ref:n {#1} }
  }
\AddToHook { begindocument / end }
  {
    \cs_if_exist:NTF \T@ref
      {
        \cs_gset_eq:NN \lf_single_ref:n \T@ref
        \cs_gset_eq:NN \T@ref \lf_ref_dispatch:n
      }
      { \cs_gset_eq:NN \@kernel@ref \lf_ref_dispatch:n }
  }


% ========================================
% KEYS SHARED BY EVERY COMMAND
% ========================================
\tl_new:N \g_lf_label_tl
\tl_new:N \g_lf_caption_tl
\tl_new:N \g_lf_width_tl
\tl_new:N \g_lf_height_tl
\tl_new:N \g_lf_spread_tl
\tl_new:N \g_lf_subcaption_tl
\tl_new:N \g_lf_place_tl
\tl_new:N \g_lf_calign_tl
\tl_new:N \g_lf_hyphenate_tl

\keys_define:nn { labforge / block }
  {
    label   .tl_gset:N  = \g_lf_label_tl,
    caption .tl_gset:N  = \g_lf_caption_tl,
    width   .tl_gset:N  = \g_lf_width_tl,
    height  .tl_gset:N  = \g_lf_height_tl,
    spread  .tl_gset:N  = \g_lf_spread_tl,
    subcaption .tl_gset:N = \g_lf_subcaption_tl,
    caption-align .choices:nn = { justify, center, left, right } { \tl_gset_eq:NN \g_lf_calign_tl \l_keys_choice_tl },
    hyphenate     .choices:nn = { true, false } { \tl_gset_eq:NN \g_lf_hyphenate_tl \l_keys_choice_tl },
    place   .choices:nn = { here, span, float, wrap, wrap-left } { \tl_gset_eq:NN \g_lf_place_tl \l_keys_choice_tl },
  }

\msg_new:nnn { labforge } { unused-key }
  { \iow_char:N \\#1~has~no~#2~key,~so~it~is~ignored. }

% #1 command name, #2 keys it accepts, #3 the keys given.
\cs_new_protected:Npn \lf_keys:nnn #1#2#3
  {
    \tl_gclear:N \g_lf_label_tl
    \tl_gclear:N \g_lf_caption_tl
    \tl_gclear:N \g_lf_width_tl
    \tl_gclear:N \g_lf_height_tl
    \tl_gclear:N \g_lf_spread_tl
    \tl_gclear:N \g_lf_subcaption_tl
    \tl_gclear:N \g_lf_calign_tl
    \tl_gclear:N \g_lf_hyphenate_tl
    \tl_gset:Nn  \g_lf_place_tl { here }
    \keys_set:nn { labforge / block } {#3}
    \clist_map_inline:nn { label, caption, subcaption, width, height, spread }
      {
        \clist_if_in:nnF {#2} {##1}
          {
            \tl_if_empty:cF { g_lf_##1_tl }
              { \msg_warning:nnnn { labforge } { unused-key } {#1} {##1} }
          }
      }
    \tl_if_empty:NF \g_lf_calign_tl
      { \clist_if_in:nnF {#2} { caption-align } { \msg_warning:nnnn { labforge } { unused-key } {#1} { caption-align } } }
    \tl_if_empty:NF \g_lf_hyphenate_tl
      { \clist_if_in:nnF {#2} { hyphenate } { \msg_warning:nnnn { labforge } { unused-key } {#1} { hyphenate } } }
  }

% The default label of a figure, plot or table: a kind prefix (fig:, plot:,
% tab:) and the file name without the folder or the extension:
% \myfigure{setup/photo.png} is fig:photo.
\cs_new_protected:Npn \lf_default_label:nn #1#2   % prefix, file
  {
    \tl_if_empty:NT \g_lf_label_tl
      {
        \file_parse_full_name:nNNN {#2} \l_lf_dir_tl \l_lf_name_tl \l_lf_ext_tl
        \tl_gset:Ne \g_lf_label_tl
          { #1 : \l_lf_name_tl }
      }
  }
\cs_generate_variant:Nn \lf_default_label:nn { ne }
\tl_new:N \l_lf_dir_tl
\tl_new:N \l_lf_name_tl
\tl_new:N \l_lf_ext_tl

% width: a length, or a plain number as a fraction of the line width.
\cs_new_protected:Npn \lf_width:NN #1#2
  {
    \tl_if_blank:VTF #2
      { \dim_set:Nn #1 { \linewidth } }
      {
        \regex_match:nVTF { \A \s* \d* \.? \d+ \s* \Z } #2
          { \dim_set:Nn #1 { #2 \linewidth } }
          { \dim_set:Nn #1 { #2 } }
      }
  }
\cs_generate_variant:Nn \regex_match:nnTF { nV }


% ========================================
% COLUMNS
% ========================================
\bool_new:N \g_lf_in_columns_bool
\hook_gput_code:nnn { env / multicols / begin } { labforge } { \bool_gset_true:N \g_lf_in_columns_bool }
\hook_gput_code:nnn { env / multicols / end }   { labforge } { \bool_gset_false:N \g_lf_in_columns_bool }

% Run #1 across the full text width: close the columns, run it, reopen them.
% Columns already set are balanced first.
\cs_new_protected:Npn \lf_span:n #1
  {
    \bool_if:NTF \g_lf_in_columns_bool
      {
        \use:e
          {
            \exp_not:N \end { multicols }
            \exp_not:n {#1}
            \exp_not:N \begin { multicols } { \int_use:N \col@number }
          }
      }
      {#1}
  }

\msg_new:nnn { labforge } { no-wrap }
  { place=#1~works~for~figures~and~plots~in~one~column;~this~block~is~placed~here. }

% A block written in the middle of a paragraph is set after the line it is
% written on, and the paragraph goes on under it.
\bool_new:N \l_lf_inline_bool
\cs_new_protected:Npn \lf_inline:n #1
  { \mode_if_horizontal:TF { \vadjust { \bool_set_true:N \l_lf_inline_bool #1 } } {#1} }

\cs_new_protected:Npn \lf_place:n #1
  {
    \str_case:Vn \g_lf_place_tl
      {
        { here }      { \lf_inline:n {#1} }
        { span }      { \lf_span:n {#1} }
        { float }     { \lf_float:n {#1} }
        { wrap }      { \msg_warning:nnV { labforge } { no-wrap } \g_lf_place_tl #1 }
        { wrap-left } { \msg_warning:nnV { labforge } { no-wrap } \g_lf_place_tl #1 }
      }
  }
\cs_generate_variant:Nn \msg_warning:nnn { nnV }


% ========================================
% FLOATING BLOCKS
% ========================================
% place=float lets the text that follows a block fill the rest of the column
% when the block does not fit there; the block then follows the first
% paragraph that reaches the next column or page. Like references, this
% uses the previous run: the .aux file records where each body paragraph
% ends, where each floating block was asked for, and where it started and
% ended. latexmk reruns until the positions settle.
\int_new:N  \g_lf_para_int
\int_new:N  \g_lf_float_int
\int_new:N  \g_lf_text_bottom_int
\bool_new:N \g_lf_in_block_bool
\tl_new:N   \g_lf_block_end_tl
\tl_new:N   \l_lf_float_code_tl
\int_new:N  \l_lf_release_int
\bool_new:N \l_lf_defer_bool
\seq_new:N  \g_lf_release_seq

% Writes "\lf@<#1>{<#2>}{<page>}{<height on the page>}" to the .aux file.
\cs_new_protected:Npn \lf_write_pos:nn #1#2
  {
    \lf_savepos:
    \use:e
      {
        \tex_write:D \exp_not:N \@auxout
          {
            \exp_not:c { lf@#1 } { \int_eval:n {#2} }
              { \exp_not:N \the \exp_not:N \c@page } { \exp_not:N \the \exp_not:N \lf_lastypos: }
          }
      }
  }
\cs_new_protected:Npn \lf_store_pos:nnnn #1#2#3#4
  {
    \cs_gset:cpn { lf@#1@page@#2 } {#3}
    \cs_gset:cpn { lf@#1@y@#2 } {#4}
  }
\cs_new_protected:Npn \lf@para #1#2#3       { \lf_store_pos:nnnn { para } {#1} {#2} {#3} }
\cs_new_protected:Npn \lf@floatsrc #1#2#3   { \lf_store_pos:nnnn { floatsrc } {#1} {#2} {#3} }
\cs_new_protected:Npn \lf@floatstart #1#2#3 { \lf_store_pos:nnnn { floatstart } {#1} {#2} {#3} }
\cs_new_protected:Npn \lf@floatend #1#2#3   { \lf_store_pos:nnnn { floatend } {#1} {#2} {#3} }

% Body paragraphs are counted; captions and title lines are not, so the
% count does not change when a block moves.
\hook_gput_code:nnn { para / end } { labforge }
  {
    \bool_if:NF \g_lf_in_block_bool
      {
        \int_gincr:N \g_lf_para_int
        \lf_write_pos:nn { para } { \g_lf_para_int }
        \lf_write_x:nn { parax } { \g_lf_para_int }
      }
  }

% Writes "\lf@<#1>{<#2>}{<x on the page>}" to the .aux file: where a paragraph's
% last line ends, or where a formula's column starts.
\cs_new_protected:Npn \lf_write_x:nn #1#2
  {
    \lf_savepos:
    \use:e
      {
        \tex_write:D \exp_not:N \@auxout
          { \exp_not:c { lf@#1 } { \int_eval:n {#2} } { \exp_not:N \the \exp_not:N \lf_lastxpos: } }
      }
  }
\cs_new_protected:Npn \lf@parax #1#2 { \cs_gset:cpn { lf@parax@#1 } {#2} }
\cs_new_protected:Npn \lf@mathx #1#2 { \cs_gset:cpn { lf@mathx@#1 } {#2} }
\hook_gput_code:nnn { para / after } { labforge }
  {
    \bool_if:NF \g_lf_in_block_bool
      { \lf_release:n { \g_lf_para_int } }
  }

% The bottom of the text block, measured like the positions: from the
% bottom of the page.
\hook_gput_code:nnn { begindocument / end } { labforge }
  {
    \int_gset:Nn \g_lf_text_bottom_int
      {
        \dim_to_decimal_in_sp:n
          {
            \paperheight - 1in - \voffset - \topmargin
            - \headheight - \headsep - \textheight
          }
      }
  }

\cs_new_protected:Npn \lf_release:n #1
  {
    \tl_if_exist:cT { g_lf_release_ \int_eval:n {#1} _tl }
      {
        \tl_set_eq:Nc \l_lf_float_code_tl { g_lf_release_ \int_eval:n {#1} _tl }
        \tl_gclear:c { g_lf_release_ \int_eval:n {#1} _tl }
        \l_lf_float_code_tl
      }
  }

% Blocks still waiting at the end of the document go there.
\cs_new_protected:Npn \lf_release_rest:
  {
    \seq_map_inline:Nn \g_lf_release_seq
      {
        \tl_if_empty:cF { g_lf_release_##1_tl }
          {
            \tl_set_eq:Nc \l_lf_float_code_tl { g_lf_release_##1_tl }
            \tl_gclear:c { g_lf_release_##1_tl }
            \l_lf_float_code_tl
          }
      }
  }
\AtEndDocument { \lf_wrap_clear: \lf_release_rest: }

\cs_new:Npn \lf_pos:nnn #1#2#3 { \use:c { lf@#1@#2@#3 } }   % kind, page or y, number

\cs_new_protected:Npn \lf_float:n #1
  {
    \int_gincr:N \g_lf_float_int
    \par
    \lf_write_pos:nn { floatsrc } { \g_lf_float_int }
    % The block, with the key values it was given, to run here or later.
    \tl_set:Ne \l_lf_float_code_tl
      {
        \exp_not:N \tl_gset:Nn \exp_not:N \g_lf_label_tl   { \exp_not:V \g_lf_label_tl }
        \exp_not:N \tl_gset:Nn \exp_not:N \g_lf_caption_tl { \exp_not:V \g_lf_caption_tl }
        \exp_not:N \tl_gset:Nn \exp_not:N \g_lf_calign_tl { \exp_not:V \g_lf_calign_tl }
        \exp_not:N \tl_gset:Nn \exp_not:N \g_lf_hyphenate_tl { \exp_not:V \g_lf_hyphenate_tl }
        \exp_not:N \tl_gset:Nn \exp_not:N \g_lf_width_tl   { \exp_not:V \g_lf_width_tl }
        \exp_not:N \tl_gset:Nn \exp_not:N \g_lf_height_tl  { \exp_not:V \g_lf_height_tl }
        \exp_not:N \tl_gset:Nn \exp_not:N \g_lf_spread_tl  { \exp_not:V \g_lf_spread_tl }
        \exp_not:N \tl_gset:Nn \exp_not:N \g_lf_subcaption_tl { \exp_not:V \g_lf_subcaption_tl }
        \exp_not:N \lf_float_emit:nn { \int_use:N \g_lf_float_int } { \exp_not:n {#1} }
      }
    \bool_set_false:N \l_lf_defer_bool
    \tl_set:Ne \l_tmpa_tl { \int_use:N \g_lf_float_int }
    \bool_lazy_and:nnT
      { \cs_if_exist_p:c { lf@floatsrc@y@ \l_tmpa_tl } }
      { \cs_if_exist_p:c { lf@floatend@y@ \l_tmpa_tl } }
      {
        % Defer when the block last ran past the end of its column, or when
        % the room left below the source is less than the block's height.
        \bool_lazy_or:nnTF
          {
            \bool_lazy_or_p:nn
              {
                \int_compare_p:nNn
                  { \lf_pos:nnn { floatend } { page } { \l_tmpa_tl } }
                  > { \lf_pos:nnn { floatstart } { page } { \l_tmpa_tl } }
              }
              {
                \int_compare_p:nNn
                  { \lf_pos:nnn { floatend } { y } { \l_tmpa_tl } }
                  > { \lf_pos:nnn { floatstart } { y } { \l_tmpa_tl } }
              }
          }
          {
            \int_compare_p:nNn
              { \lf_pos:nnn { floatsrc } { y } { \l_tmpa_tl } - \g_lf_text_bottom_int }
              <
              {
                \lf_pos:nnn { floatstart } { y } { \l_tmpa_tl }
                - \lf_pos:nnn { floatend } { y } { \l_tmpa_tl }
              }
          }
          { \bool_set_true:N \l_lf_defer_bool }
          { }
      }
    \bool_if:NTF \l_lf_defer_bool
      { \lf_defer:VV \l_tmpa_tl \l_lf_float_code_tl }
      { \l_lf_float_code_tl }
  }

% Queue code #2 of floating block #1 after the first later paragraph that
% ended in another column or on a later page; without one, at the end of
% the document.
\cs_new_protected:Npn \lf_defer:nn #1#2
  {
        \tl_set:Nn \l_tmpa_tl {#1}
        \int_set:Nn \l_lf_release_int { \g_lf_para_int + 1 }
        \bool_do_until:nn
          {
            ! \cs_if_exist_p:c { lf@para@y@ \int_use:N \l_lf_release_int }
            || \int_compare_p:nNn
                 { \lf_pos:nnn { para } { page } { \int_use:N \l_lf_release_int } }
                 > { \lf_pos:nnn { floatsrc } { page } { \l_tmpa_tl } }
            || \int_compare_p:nNn
                 { \lf_pos:nnn { para } { y } { \int_use:N \l_lf_release_int } }
                 > { \lf_pos:nnn { floatsrc } { y } { \l_tmpa_tl } }
          }
          { \int_incr:N \l_lf_release_int }
        \tl_if_exist:cF { g_lf_release_ \int_use:N \l_lf_release_int _tl }
          {
            \tl_new:c { g_lf_release_ \int_use:N \l_lf_release_int _tl }
            \seq_gput_right:Ne \g_lf_release_seq { \int_use:N \l_lf_release_int }
          }
        \tl_gput_right:cn { g_lf_release_ \int_use:N \l_lf_release_int _tl } {#2}
  }
\cs_generate_variant:Nn \lf_defer:nn { VV }

% Runs a floating block and records where it started and where it ended,
% before the space after it.
\cs_new_protected:Npn \lf_float_emit:nn #1#2
  {
    \par
    \lf_write_pos:nn { floatstart } {#1}
    \tl_gset:Nn \g_lf_block_end_tl { \lf_write_pos:nn { floatend } {#1} }
    #2
  }


% ========================================
% BLOCKS ON THE LINE GRID
% ========================================
% A block (figure, plot, equation, reaction) is set in a box whose height is
% rounded up to whole lines and which starts and ends on a line, so the text
% after it stays on the grid. Blocks use block-space lines before and after,
% equations and reactions math-space; back-to-back graphics, plots and tables
% are block-gap lines apart, never less than the lines a table keeps under it.
\box_new:N  \g_lf_block_box
\bool_new:N \g_lf_after_block_bool
\bool_new:N \g_lf_after_heading_bool
\int_new:N  \g_lf_trailing_int
\int_new:N  \l_lf_lines_int
\dim_new:N  \l_lf_lead_dim

\hook_gput_code:nnn { para / begin } { labforge }
  {
    \bool_gset_false:N \g_lf_after_block_bool
    \bool_gset_false:N \g_lf_after_heading_bool
  }

\cs_new_protected:Npn \lf_skip_lines:n #1
  { \skip_vertical:n { \int_eval:n {#1} \g_lf_line_dim } }

% #1 space before, #2 gap after another block
% A heading stays with what follows it: a block that comes within the first
% two lines after a heading cannot be split from them, so the heading moves
% to the next page or column with it.
\bool_new:N \g_lf_heading_open_bool
\int_new:N  \g_lf_heading_lines_int
\hook_gput_code:nnn { para / after } { labforge / keep }
  {
    \bool_lazy_and:nnT { \g_lf_heading_open_bool } { ! \g_lf_in_block_bool }
      {
        \int_gadd:Nn \g_lf_heading_lines_int { \tex_prevgraf:D }
        \int_compare:nNnT { \g_lf_heading_lines_int } > { 2 }
          { \bool_gset_false:N \g_lf_heading_open_bool }
      }
  }

\int_new:N  \g_lf_math_int
\cs_new_protected:Npn \lf_block_before:nn #1#2
  {
    \lf_wrap_clear:
    \par
    % A formula records where its column starts, when the text just above
    % it is a paragraph; \lf_math_gaps: compares it with where that
    % paragraph's last line ended (both from the previous run).
    \bool_if:NT \l_lf_math_measure_bool
      {
        \int_gincr:N \g_lf_math_int
        \int_set_eq:NN \l_lf_math_para_int \g_lf_para_int
        \bool_set_false:N \l_lf_math_after_text_bool
        \bool_lazy_or:nnF { \g_lf_after_block_bool } { \g_lf_after_heading_bool }
          {
            \bool_set_true:N \l_lf_math_after_text_bool
            \lf_write_x:nn { mathx } { \g_lf_math_int }
          }
      }
    \bool_if:NT \g_lf_heading_open_bool
      {
        \nobreak
        \bool_gset_false:N \g_lf_heading_open_bool
      }
    \int_gzero:N \g_lf_last_unit_int
    \int_zero:N \l_lf_added_int
    \bool_if:NTF \g_lf_after_block_bool
      { \int_set:Nn \l_lf_added_int { #2 } \lf_skip_lines:n { \int_max:nn { 0 } { #2 - \g_lf_trailing_int } } }
      {
        \bool_if:NF \g_lf_after_heading_bool
          { \int_set:Nn \l_lf_added_int { #1 } \lf_skip_lines:n {#1} }
      }
  }
\int_new:N \l_lf_added_int
\bool_new:N \l_lf_math_measure_bool
\bool_new:N \l_lf_math_after_text_bool
\int_new:N \l_lf_math_para_int
\dim_new:N \l_lf_math_wd_dim

\cs_new_protected:Npn \lf_block_after:n #1
  {
    \tl_if_empty:NF \g_lf_block_end_tl
      {
        \g_lf_block_end_tl
        \tl_gclear:N \g_lf_block_end_tl
      }
    \int_compare:nNnT {#1} > { 0 } { \lf_skip_lines:n {#1} }
    \int_gset:Nn \g_lf_trailing_int {#1}
    \bool_gset_true:N \g_lf_after_block_bool
  }

% Put \g_lf_block_box on the grid. Nothing may break between the box and
% what follows it (a caption) until \lf_block_after:n.
\cs_new_protected:Npn \lf_block_box:
  {
    \int_set:Nn \l_lf_lines_int
      {
        \fp_eval:n
          {
            ceil
              (
                \dim_to_fp:n
                  { \box_ht:N \g_lf_block_box + \box_dp:N \g_lf_block_box + 0.5 \g_lf_line_dim }
                / \dim_to_fp:n { \g_lf_line_dim }
              )
          }
      }
    % Start at the baseline of the line above, end on a later baseline.
    \dim_compare:nNnF { \prevdepth } < { -999pt } { \skip_vertical:n { -\prevdepth } }
    \nointerlineskip
    \vbox_to_ht:nn { \l_lf_lines_int \g_lf_line_dim }
      {
        \skip_vertical:n { 0.3 \g_lf_line_dim }
        \vss
        \box_use_drop:N \g_lf_block_box
        \vss
      }
    \tex_prevdepth:D = \c_zero_dim
  }
% The box, then #1 lines of space.
\cs_new_protected:Npn \lf_block_put:n #1
  {
    \lf_block_box:
    \lf_block_after:n {#1}
  }

% A figure or plot with its subcaptions and caption is one box. It is
% rounded up to whole lines, so the text after it stays on the grid, and the
% space left over goes outside the box: split so that the white from the
% line above to the box equals the white from the box to the capitals of
% the line below.
\int_new:N \g_lf_unit_int
\int_new:N \g_lf_last_unit_int
\dim_new:N \l_lf_unit_top_dim       % from the box top down to its first ink
\dim_new:N \l_lf_unit_bottom_dim    % from its last ink down to the box bottom
\dim_new:N \l_lf_unit_ink_dim
\dim_new:N \l_lf_unit_slack_dim
\dim_new:N \l_lf_unit_even_dim
\cs_new_protected:Npn \lf@unitend #1 { \cs_gset:cpn { lf@unitend@#1 } { } }

% The space around a block, set by block-snap. Figures, plots and tables keep
% the white of an ordinary line break plus half a line above and below (from
% the baseline of the line before, to the capitals of the line after);
% formulas, equations and reactions add nothing and stand among the lines
% like a line of text.
%   off   the white is exactly that, and the text goes on where the block ends
%   line  the white grows, equally above and below, until the block fills
%         whole lines, so the text after it stays on the grid (at most one
%         line more)
%   half  the same in half lines (at most half a line more)
%   auto  off in one column, line in columns, where the grid keeps the lines
%         of neighbouring columns level
\cs_new:Npn \lf_unit_min: { \dim_eval:n { 1.5 \g_lf_line_dim - \fontcharht \font `X } }

% A formula taller than a line of text (a fraction, a root over a fraction)
% gets math-gap of a line above and below. Above it is left out when the
% paragraph before it ended its last line before the formula starts, as
% LaTeX does with its short display skip; below it is left out before a
% heading, whose blank line is space enough.
\dim_new:N \l_lf_math_above_dim
\dim_new:N \l_lf_math_below_dim
\cs_new_protected:Npn \lf_math_gaps:
  {
    \bool_lazy_or:nnT
      {
        \dim_compare_p:nNn
          { \box_ht:N \g_lf_block_box - \l_lf_unit_top_dim } > { 0.7 \g_lf_line_dim + 0.5pt }
      }
      {
        \dim_compare_p:nNn
          { \box_dp:N \g_lf_block_box - \l_lf_unit_bottom_dim } > { 0.3 \g_lf_line_dim + 0.5pt }
      }
      {
        \dim_set:Nn \l_lf_math_above_dim { \l_lf_math_gap_tl \g_lf_line_dim }
        \dim_set_eq:NN \l_lf_math_below_dim \l_lf_math_above_dim
        % Written inside a paragraph, it follows a full line: the space stays.
        \bool_if:NTF \l_lf_math_after_text_bool
          {
            \bool_lazy_all:nT
              {
                { ! \l_lf_inline_bool }
                { \cs_if_exist_p:c { lf@parax@ \int_use:N \l_lf_math_para_int } }
                { \cs_if_exist_p:c { lf@mathx@ \int_use:N \g_lf_math_int } }
              }
              {
                \int_compare:nNnT
                  {
                    \use:c { lf@parax@ \int_use:N \l_lf_math_para_int }
                    + \dim_to_decimal_in_sp:n { 2em }
                  }
                  <
                  {
                    \use:c { lf@mathx@ \int_use:N \g_lf_math_int }
                    + \dim_to_decimal_in_sp:n { ( \linewidth - \l_lf_math_wd_dim ) / 2 }
                  }
                  { \dim_zero:N \l_lf_math_above_dim }
              }
          }
          { \dim_zero:N \l_lf_math_above_dim }
        \cs_if_exist:cT { lf@unitend@ \int_use:N \g_lf_unit_int }
          { \dim_zero:N \l_lf_math_below_dim }
      }
  }

% The natural width of a formula's rows: the math set once more as aligned,
% with labels, tags and row numbers switched off for that measure only.
\cs_new_protected:Npn \lf_formula_width:n #1
  {
    \hbox_set:Nn \l_tmpa_box
      {
        \cs_set_eq:NN \label \use_none:n
        \cs_set:Npn \tag { \@ifstar \use_none:n \use_none:n }
        \cs_set_eq:NN \nonumber \scan_stop:
        \cs_set_eq:NN \notag \scan_stop:
        $ \displaystyle \begin{aligned} #1 \end{aligned} $
      }
    \dim_set:Nn \l_lf_math_wd_dim { \box_wd:N \l_tmpa_box }
    \box_clear:N \l_tmpa_box
  }
\tl_new:N \l_lf_snap_use_tl
\cs_new_protected:Npn \lf_snap_set:
  {
    \str_if_eq:VnTF \l_lf_snap_tl { auto }
      { \tl_set:Ne \l_lf_snap_use_tl { \bool_if:NTF \g_lf_in_columns_bool { line } { off } } }
      { \tl_set_eq:NN \l_lf_snap_use_tl \l_lf_snap_tl }
  }
% The step the grid placement rounds to.
\cs_new:Npn \lf_snap_step: { \str_if_eq:VnTF \l_lf_snap_use_tl { half } { 0.5 } { 1 } \g_lf_line_dim }

\cs_new_protected:Npn \lf_unit_put:nn #1#2   % lines after, white above and below
  {
    \int_gincr:N \g_lf_unit_int
    \lf_snap_set:
    \dim_set:Nn \l_lf_unit_ink_dim
      {
        \box_ht:N \g_lf_block_box + \box_dp:N \g_lf_block_box
        - \l_lf_unit_top_dim - \l_lf_unit_bottom_dim
      }
    \dim_zero:N \l_lf_math_above_dim
    \dim_zero:N \l_lf_math_below_dim
    \dim_compare:nNnT {#2} = { \c_zero_dim } { \lf_math_gaps: }
    \str_if_eq:VnTF \l_lf_snap_use_tl { off }
      { \lf_unit_free:n {#2} }
      {
        % The gaps count as part of the formula when it is rounded to steps.
        \dim_sub:Nn \l_lf_unit_top_dim { \l_lf_math_above_dim }
        \dim_sub:Nn \l_lf_unit_bottom_dim { \l_lf_math_below_dim }
        \dim_add:Nn \l_lf_unit_ink_dim { \l_lf_math_above_dim + \l_lf_math_below_dim }
        \lf_unit_grid:n {#2}
      }
    \dim_zero:N \l_lf_unit_top_dim
    \dim_zero:N \l_lf_unit_bottom_dim
    \lf_block_after:n {#1}
    \int_gset_eq:NN \g_lf_last_unit_int \g_lf_unit_int
  }

% off: a block has exactly #2 of white above and below; math (#2 zero) is
% stacked like a line, a line's distance from the lines around it, or
% closer only when it is taller.
\cs_new_protected:Npn \lf_unit_free:n #1
  {
    \dim_compare:nNnTF {#1} = { \c_zero_dim }
      {
        \skip_vertical:N \l_lf_math_above_dim
        \group_begin:
          \lineskiplimit = \c_zero_dim
          \lineskip = 0.1 \g_lf_line_dim
          \box_use_drop:N \g_lf_block_box
        \group_end:
        \skip_vertical:N \l_lf_math_below_dim
      }
      {
        \dim_compare:nNnF { \prevdepth } < { -999pt } { \skip_vertical:n { -\prevdepth } }
        \nointerlineskip
        \skip_vertical:n { #1 - \l_lf_unit_top_dim }
        \dim_set:Nn \l_tmpa_dim { \l_lf_unit_bottom_dim }
        % Before a heading (known from the previous run) the block ends like a
        % line of text, so the heading's blank line is the only space after it.
        \cs_if_exist:cTF { lf@unitend@ \int_use:N \g_lf_unit_int }
          {
            \dim_set:Nn \l_tmpa_dim { \box_dp:N \g_lf_block_box }
            \box_use_drop:N \g_lf_block_box
            \tex_prevdepth:D = \l_tmpa_dim
          }
          {
            \box_use_drop:N \g_lf_block_box
            % The next line's capitals sit #1 below the block.
            \skip_vertical:n { #1 + \fontcharht \font `X - \g_lf_line_dim - \l_tmpa_dim }
            \tex_prevdepth:D = \c_zero_dim
          }
      }
  }

% line, half: the block takes as few steps as leave #2 of white on both
% sides, with the white left over split equally. A block that a heading
% follows (known from the previous run) takes the white left over above it
% and its last baseline sits on the step, as a line of text does, so the
% heading's blank line is the only space before the heading.
\cs_new_protected:Npn \lf_unit_grid:n #1
  {
    \dim_set:Nn \l_tmpb_dim { \g_lf_line_dim - \fontcharht \font `X }
    \int_set:Nn \l_lf_lines_int
      {
        \int_max:nn { 1 }
          {
            \fp_eval:n
              {
                ceil ( \dim_to_fp:n { \l_lf_unit_ink_dim + #1 + #1 - \l_tmpb_dim } / \dim_to_fp:n { \lf_snap_step: } - 0.0001 )
              }
          }
      }
    \dim_set:Nn \l_lf_unit_slack_dim { \lf_snap_step: * \l_lf_lines_int - \l_lf_unit_ink_dim }
    \dim_set:Nn \l_lf_unit_even_dim { ( \l_lf_unit_slack_dim + \l_tmpb_dim ) / 2 }
    \cs_if_exist:cTF { lf@unitend@ \int_use:N \g_lf_unit_int }
      {
        \dim_set:Nn \l_tmpb_dim
          {
            \dim_max:nn {#1}
              { \lf_snap_step: * \l_lf_lines_int - \box_ht:N \g_lf_block_box + \l_lf_unit_top_dim }
          }
      }
      { \dim_set_eq:NN \l_tmpb_dim \l_lf_unit_even_dim }
    \dim_compare:nNnF { \prevdepth } < { -999pt } { \skip_vertical:n { -\prevdepth } }
    \nointerlineskip
    \vbox_to_ht:nn { \lf_snap_step: * \l_lf_lines_int }
      {
        \skip_vertical:n { \l_tmpb_dim - \l_lf_unit_top_dim }
        \box_use_drop:N \g_lf_block_box
        \vss
      }
    \tex_prevdepth:D = \c_zero_dim
  }

% Captions and subcaptions are set closer than body text: caption-spread
% times the line spread, and never closer than single spacing.
\cs_new_protected:Npn \lf_caption_leading:
  {
    \baselineskip = \fp_to_dim:n
      {
        \dim_to_fp:n { \g_lf_line_dim }
        * max ( \l_lf_caption_spread_tl , 1 / \l_lf_spread_tl )
      }
    \lineskiplimit = \c_zero_dim
    \lineskip = \c_zero_dim
  }

% The caption under a figure, caption-gap lines below it, inside the box.
% #1 runs inside the caption, before the label (side-by-side part labels).
\cs_new_protected:Npn \lf_unit_caption:n #1
  {
    \tl_if_blank:VF \g_lf_caption_tl
      {
        \skip_vertical:n { \l_lf_caption_gap_tl \g_lf_line_dim }
        \nointerlineskip
        \group_begin:
          \lf_caption_leading:
          \dim_set:Nn \l_lf_lead_dim { ( \linewidth - \l_lf_caption_dim ) / 2 }
          \lf_caption:nnn { figure } { \thefigure }
            { #1 \lf_label:Vn \g_lf_label_tl { figure } \g_lf_caption_tl }
        \group_end:
      }
  }

% Caption paragraph: "Figure 3: text", indented #3 on both sides.
\cs_new_protected:Npn \lf_caption:nnn #1#2#3   % name key, number, text
  {
    \group_begin:
      \parindent = \c_zero_dim
      % The block's caption-align, else its kind's setting, else caption-align.
      \tl_set_eq:NN \l_lf_caption_use_tl \g_lf_calign_tl
      \tl_if_empty:NT \l_lf_caption_use_tl
        {
          \tl_if_exist:cT { l_lf_caption_align_ \l_lf_caption_kind_tl _tl }
            { \tl_set_eq:Nc \l_lf_caption_use_tl { l_lf_caption_align_ \l_lf_caption_kind_tl _tl } }
        }
      \tl_if_empty:NT \l_lf_caption_use_tl
        { \tl_set_eq:NN \l_lf_caption_use_tl \l_lf_caption_align_tl }
      \str_if_eq:VnTF \g_lf_hyphenate_tl { false }
        { \hyphenpenalty = 10000 \exhyphenpenalty = 10000 }
        {
          \str_if_eq:VnF \g_lf_hyphenate_tl { true }
            { \bool_if:NF \l_lf_caption_hyphenate_bool { \hyphenpenalty = 10000 \exhyphenpenalty = 10000 } }
        }
      \str_case:Vn \l_lf_caption_use_tl
        {
          { justify }
            {
              \leftskip = \l_lf_lead_dim
              \rightskip = \l_lf_lead_dim
              \parfillskip = \c_zero_dim plus 1fil
            }
          { center }
            {
              \leftskip = \l_lf_lead_dim plus 1fil
              \rightskip = \l_lf_lead_dim plus 1fil
              \parfillskip = \c_zero_dim
            }
          { left }
            {
              \leftskip = \l_lf_lead_dim
              \rightskip = \l_lf_lead_dim plus 1fil
            }
          { right }
            {
              \leftskip = \l_lf_lead_dim plus 1fil
              \rightskip = \l_lf_lead_dim
              \parfillskip = \c_zero_dim
            }
        }
      \interlinepenalty = 10000
      \bool_gset_true:N \g_lf_in_block_bool
      \noindent
      \bool_if:NTF \l_lf_caption_theme_bool { \color { lfTheme } } { \color { \l_lf_caption_color_tl } }
      \textbf { \lf_text:n {#1} \nobreakspace #2 : } ~ #3 \par
    \group_end:
    \bool_gset_false:N \g_lf_in_block_bool
  }


% ========================================
% FIGURES AND PLOTS
% ========================================
\box_new:N \l_lf_image_box
\dim_new:N \l_lf_width_dim
\dim_new:N \l_lf_caption_dim

% A plot hangs its y label and tick labels to the left of the frame, so
% centring the whole picture puts the frame right of centre. The picture gets
% blank space on its right: plot-balance times the width of those left labels
% (0 keeps the picture centred, 1 centres the frame itself). The width of the
% left labels is written to the .aux file and the plot is narrowed by that
% space on the next run, so the picture keeps the width it was asked for.
\dim_new:N \g_lf_plot_left_dim
\tl_new:N  \g_lf_plot_file_tl
\cs_new_protected:Npn \lf@plotleft #1#2 { \cs_gset:cpn { lf@plotleft@#1 } {#2} }
\cs_new_protected:Npn \lf_plot_balance:
  {
    \path ~ let ~ \p1 = (current~bounding~box.west), \p2 = (current~axis.west) ~ in
      ~ \pgfextra { \dim_gset:Nn \g_lf_plot_left_dim { \x2 - \x1 } } ;
    \path ~ (current~bounding~box.east) ++ ( \dim_eval:n { \l_lf_plot_balance_tl \g_lf_plot_left_dim } , 0pt ) ;
    \use:e
      {
        \exp_not:N \protected@write \exp_not:N \@auxout { }
          { \exp_not:N \string \exp_not:N \lf@plotleft { \exp_not:V \g_lf_plot_file_tl } { \dim_use:N \g_lf_plot_left_dim } }
      }
  }

% #1 graphics or plot, #2 file
\cs_new_protected:Npn \lf_image:nn #1#2
  {
    \lf_width:NN \l_lf_width_dim \g_lf_width_tl
    \hbox_set:Nn \l_lf_image_box
      {
        \str_if_eq:nnTF {#1} { plot }
          {
            \tikzset { every~picture/.append~style = { execute~at~end~picture = \lf_plot_balance: } }
            \tl_gset:Nn \g_lf_plot_file_tl {#2}
            \cs_if_exist:cTF { lf@plotleft@#2 }
              { \dim_set:Nn \l_tmpa_dim { \fp_to_dim:n { \l_lf_plot_balance_tl * \dim_to_fp:n { \use:c { lf@plotleft@#2 } } } } }
              { \dim_zero:N \l_tmpa_dim }
            \pgfplotsset { width = \dim_eval:n { \l_lf_width_dim - \l_tmpa_dim } }
            \tl_if_blank:VF \g_lf_height_tl { \pgfplotsset { height = \g_lf_height_tl } }
            \input { plots/#2 }
          }
          {
            \tl_if_blank:VTF \g_lf_height_tl
              { \includegraphics [ width = \l_lf_width_dim ] {#2} }
              {
                \tl_if_blank:VTF \g_lf_width_tl
                  { \includegraphics [ height = \g_lf_height_tl ] {#2} }
                  { \includegraphics [ width = \l_lf_width_dim, height = \g_lf_height_tl ] {#2} }
              }
          }
      }
  }

% The kind of a caption, for its alignment: figure, plot or table.
\cs_new_protected:Npn \lf_caption_kind:n #1
  { \tl_set:Ne \l_lf_caption_kind_tl { \str_if_eq:nnTF {#1} { plot } { plot } { figure } } }

\cs_new_protected:Npn \lf_figure:nn #1#2
  {
    \lf_caption_kind:n {#1}
    \lf_block_before:nn { \l_lf_block_space_int } { \l_lf_block_gap_int }
    \lf_image:nn {#1} {#2}
    % The caption is as wide as the image, and at least half the line. It is
    % set as ordinary lines under the image, so it sits on the grid.
    \dim_set:Nn \l_lf_caption_dim
      { \dim_min:nn { \linewidth } { \dim_max:nn { \box_wd:N \l_lf_image_box } { 0.5 \linewidth } } }
    \tl_if_blank:VF \g_lf_caption_tl { \refstepcounter { figure } }
    \vbox_gset:Nn \g_lf_block_box
      {
        \hsize = \linewidth
        \hbox_to_wd:nn { \linewidth } { \hfil \box_use_drop:N \l_lf_image_box \hfil }
        \lf_unit_caption:n { }
      }
    \lf_unit_put:nn { \l_lf_block_space_int } { \lf_unit_min: }
  }

% place=wrap (right) or wrap-left: the next paragraphs run beside the
% figure, narrowed line by line for as many lines as the figure takes. If a
% heading, block or table comes first, the remaining lines are left blank,
% so nothing overlaps. One column only.
\int_new:N \g_lf_wrap_lines_int
\dim_new:N \g_lf_wrap_indent_dim
\dim_new:N \g_lf_wrap_width_dim
\dim_new:N \l_lf_wrap_gap_dim
\dim_set:Nn \l_lf_wrap_gap_dim { 1em }

\cs_new_protected:Npn \lf_wrap_clear:
  {
    \int_compare:nNnT { \g_lf_wrap_lines_int } > { 0 }
      {
        \mode_if_horizontal:T { \par }
        \lf_skip_lines:n { \g_lf_wrap_lines_int }
        \int_gzero:N \g_lf_wrap_lines_int
      }
  }

% Narrow the lines of a paragraph that starts while a figure is beside it.
\hook_gput_code:nnn { para / begin } { labforge / wrap }
  {
    \bool_lazy_and:nnT
      { \int_compare_p:nNn { \g_lf_wrap_lines_int } > { 0 } }
      { ! \g_lf_in_block_bool }
      {
        \use:e
          {
            \tex_parshape:D = \int_eval:n { \g_lf_wrap_lines_int + 1 } \c_space_tl
            \prg_replicate:nn { \g_lf_wrap_lines_int }
              { \dim_use:N \g_lf_wrap_indent_dim \c_space_tl \dim_use:N \g_lf_wrap_width_dim \c_space_tl }
            0pt \c_space_tl \dim_use:N \hsize
          }
      }
  }
\hook_gput_code:nnn { para / after } { labforge / wrap }
  {
    \bool_if:NF \g_lf_in_block_bool
      {
        \int_compare:nNnT { \g_lf_wrap_lines_int } > { 0 }
          {
            \int_gsub:Nn \g_lf_wrap_lines_int { \tex_prevgraf:D }
            \int_compare:nNnT { \g_lf_wrap_lines_int } < { 0 } { \int_gzero:N \g_lf_wrap_lines_int }
          }
      }
  }

\cs_new_protected:Npn \lf_wrap:nnn #1#2#3   % r or l, graphics or plot, file
  {
    \lf_caption_kind:n {#2}
    \lf_wrap_clear:
    \par
    \bool_gset_false:N \g_lf_after_block_bool
    \tl_if_blank:VT \g_lf_width_tl { \tl_gset:Nn \g_lf_width_tl { 0.4 } }
    \lf_image:nn {#2} {#3}
    \tl_if_blank:VF \g_lf_caption_tl { \refstepcounter { figure } }
    \vbox_set:Nn \l_tmpa_box
      {
        \hsize = \box_wd:N \l_lf_image_box
        \linewidth = \hsize
        \box_use:N \l_lf_image_box
        \tl_if_blank:VF \g_lf_caption_tl
          {
            \skip_vertical:n { \l_lf_caption_gap_tl \g_lf_line_dim }
            \nointerlineskip
            \lf_caption_leading:
            \dim_zero:N \l_lf_lead_dim
            \lf_caption:nnn { figure } { \thefigure }
              { \lf_label:Vn \g_lf_label_tl { figure } \g_lf_caption_tl }
          }
      }
    % The figure hangs 0.3 of a line below the baseline before it. Lines
    % beside it are narrowed until the first full line's capitals are at
    % least half a line below the figure, the space every block keeps.
    \int_gset:Nn \g_lf_wrap_lines_int
      {
        \int_max:nn { 1 }
          {
            \fp_eval:n
              {
                ceil
                  (
                    \dim_to_fp:n
                      {
                        0.3 \g_lf_line_dim + \box_ht:N \l_tmpa_box + \box_dp:N \l_tmpa_box
                        + \lf_unit_min: + \fontcharht \font `X
                      }
                    / \dim_to_fp:n { \g_lf_line_dim }
                  )
                - 1
              }
          }
      }
    \dim_gset:Nn \g_lf_wrap_width_dim { \hsize - \box_wd:N \l_tmpa_box - \l_lf_wrap_gap_dim }
    \str_if_eq:nnTF {#1} { l }
      { \dim_gset:Nn \g_lf_wrap_indent_dim { \box_wd:N \l_tmpa_box + \l_lf_wrap_gap_dim } }
      { \dim_gzero:N \g_lf_wrap_indent_dim }
    % A box of no height that hangs down beside the next lines, starting at
    % the top of the next line.
    \dim_set:Nn \l_tmpa_dim { \prevdepth }
    \nointerlineskip
    \vbox_to_zero:n
      {
        \skip_vertical:n { 0.3 \g_lf_line_dim - \dim_max:nn { \l_tmpa_dim } { \c_zero_dim } }
        \hbox_to_wd:nn { \hsize }
          {
            \str_if_eq:nnTF {#1} { l }
              { \box_use_drop:N \l_tmpa_box \hfil }
              { \hfil \box_use_drop:N \l_tmpa_box }
          }
        \vss
      }
    \tex_prevdepth:D = \l_tmpa_dim
    \nobreak
  }

\cs_new_protected:Npn \lf_place_figure:nn #1#2   % graphics or plot, file
  {
    \int_compare:nNnTF { \clist_count:n {#2} } > { 1 }
      { \lf_place_side:nn {#1} {#2} }
      { \lf_place_one:nn {#1} {#2} }
  }
\cs_new_protected:Npn \lf_place_one:nn #1#2
  {
    \str_case:VnF \g_lf_place_tl
      {
        { wrap }      { \lf_wrap_or_here:nnn { r } {#1} {#2} }
        { wrap-left } { \lf_wrap_or_here:nnn { l } {#1} {#2} }
      }
      { \lf_place:n { \lf_figure:nn {#1} {#2} } }
  }
\cs_new_protected:Npn \lf_wrap_or_here:nnn #1#2#3
  {
    \bool_if:NTF \g_lf_in_columns_bool
      {
        \msg_warning:nnV { labforge } { no-wrap } \g_lf_place_tl
        \lf_figure:nn {#2} {#3}
      }
      { \lf_wrap_place:nnn {#1} {#2} {#3} }
  }

% A wrapped figure that would run past the bottom of the page waits for the
% next page, like a floating block.
\cs_new_protected:Npn \lf_wrap_place:nnn #1#2#3
  {
    \int_gincr:N \g_lf_float_int
    \lf_wrap_clear:
    \par
    \lf_write_pos:nn { floatsrc } { \g_lf_float_int }
    \tl_set:Ne \l_lf_float_code_tl
      {
        \exp_not:N \tl_gset:Nn \exp_not:N \g_lf_label_tl   { \exp_not:V \g_lf_label_tl }
        \exp_not:N \tl_gset:Nn \exp_not:N \g_lf_caption_tl { \exp_not:V \g_lf_caption_tl }
        \exp_not:N \tl_gset:Nn \exp_not:N \g_lf_calign_tl { \exp_not:V \g_lf_calign_tl }
        \exp_not:N \tl_gset:Nn \exp_not:N \g_lf_hyphenate_tl { \exp_not:V \g_lf_hyphenate_tl }
        \exp_not:N \tl_gset:Nn \exp_not:N \g_lf_width_tl   { \exp_not:V \g_lf_width_tl }
        \exp_not:N \tl_gset:Nn \exp_not:N \g_lf_height_tl  { \exp_not:V \g_lf_height_tl }
        \exp_not:N \lf_wrap:nnn {#1} {#2} {#3}
      }
    \tl_set:Ne \l_tmpb_tl { \int_use:N \g_lf_float_int }
    \bool_set_false:N \l_lf_defer_bool
    \cs_if_exist:cT { lf@floatsrc@y@ \l_tmpb_tl }
      {
        % The image, and two lines for a caption.
        \lf_image:nn {#2} {#3}
        \dim_set:Nn \l_tmpa_dim
          {
            \box_ht:N \l_lf_image_box + \box_dp:N \l_lf_image_box
            + \tl_if_blank:VTF \g_lf_caption_tl { 0pt } { 2 \g_lf_line_dim }
          }
        \int_compare:nNnT
          { \lf_pos:nnn { floatsrc } { y } { \l_tmpb_tl } - \g_lf_text_bottom_int }
          < { \dim_to_decimal_in_sp:n { \l_tmpa_dim } }
          { \bool_set_true:N \l_lf_defer_bool }
      }
    \bool_if:NTF \l_lf_defer_bool
      { \lf_defer:VV \l_tmpb_tl \l_lf_float_code_tl }
      { \l_lf_float_code_tl }
  }

% SIDE BY SIDE
% Several files in one \myfigure or \myplot are set in one row under one
% caption, with sub-figure-gap between them. Without a width, each takes an
% equal share of the line; a row wider than the line is scaled to fit. The
% images share a bottom line. subcaption gives each one "(a) text" below it;
% without subcaption there are no letters and no line for them. With
% label=x and a caption, the parts are x[1], x[2], ...: "Figure 3b".
\seq_new:N \l_lf_side_files_seq
\seq_new:N \l_lf_side_subcaption_seq
\int_new:N \l_lf_side_count_int
\dim_new:N \l_lf_side_gap_dim
\dim_new:N \l_lf_side_dim
\box_new:N \l_lf_side_box
\tl_new:N  \l_lf_side_width_tl
\tl_new:N  \l_lf_side_label_tl
\fp_new:N  \l_lf_side_scale_fp

\msg_new:nnn { labforge } { no-wrap-row }
  { place=#1~works~for~one~figure~or~plot;~this~row~is~placed~here. }
\msg_new:nnn { labforge } { row-wide }
  { The~#1~images~in~this~row~are~wider~than~the~line~together,~so~they~are~scaled~to~fit. }
\msg_new:nnn { labforge } { subcaption-count }
  { \iow_char:N \\#1~has~#2~subcaptions~for~#3~files;~the~extra~ones~are~ignored. }
\msg_new:nnn { labforge } { subcaption-one }
  { \iow_char:N \\#1~shows~one~file,~so~subcaption~is~ignored. }

% #1 command name, #2 files
\cs_new_protected:Npn \lf_check_subcaption:nn #1#2
  {
    \tl_if_blank:VF \g_lf_subcaption_tl
      {
        \int_compare:nNnTF { \clist_count:n {#2} } = { 1 }
          { \msg_warning:nnn { labforge } { subcaption-one } {#1} }
          {
            \int_compare:nNnT { \clist_count:V \g_lf_subcaption_tl } > { \clist_count:n {#2} }
              {
                \msg_warning:nneee { labforge } { subcaption-count } {#1}
                  { \clist_count:V \g_lf_subcaption_tl } { \clist_count:n {#2} }
              }
          }
      }
  }
\cs_generate_variant:Nn \clist_count:n { V }

\cs_new_protected:Npn \lf_place_side:nn #1#2
  {
    \str_case:VnF \g_lf_place_tl
      {
        { wrap }      { \msg_warning:nnV { labforge } { no-wrap-row } \g_lf_place_tl \lf_inline:n { \lf_side:nn {#1} {#2} } }
        { wrap-left } { \msg_warning:nnV { labforge } { no-wrap-row } \g_lf_place_tl \lf_inline:n { \lf_side:nn {#1} {#2} } }
      }
      { \lf_place:n { \lf_side:nn {#1} {#2} } }
  }

% The image box of part #1 of the row.
\cs_new:Npn \lf_side_box:n #1 { l_lf_side_ \int_eval:n {#1} _box }

% The images of a row, each in its own box, scaled together when the row is
% wider than the line. #1 graphics or plot.
\cs_new_protected:Npn \lf_side_parts:n #1
  {
    \dim_zero:N \l_lf_side_dim
    \seq_map_indexed_inline:Nn \l_lf_side_files_seq
      {
        \box_if_exist:cF { \lf_side_box:n {##1} } { \box_new:c { \lf_side_box:n {##1} } }
        \lf_image:nn {#1} {##2}
        \box_set_eq:cN { \lf_side_box:n {##1} } \l_lf_image_box
        \dim_add:Nn \l_lf_side_dim { \box_wd:N \l_lf_image_box }
      }
    % A row wider than the line is scaled down as a whole. Plots can come out
    % a little wider than their share, so only a width or height given warns.
    \dim_compare:nNnT
      { \l_lf_side_dim + \int_eval:n { \l_lf_side_count_int - 1 } \l_lf_side_gap_dim } > { \linewidth + 0.1pt }
      {
        \bool_lazy_and:nnF { \tl_if_blank_p:V \l_lf_side_width_tl } { \tl_if_blank_p:V \g_lf_height_tl }
          { \msg_warning:nne { labforge } { row-wide } { \int_use:N \l_lf_side_count_int } }
        \fp_set:Nn \l_lf_side_scale_fp
          {
            \dim_to_fp:n { \linewidth - \int_eval:n { \l_lf_side_count_int - 1 } \l_lf_side_gap_dim }
            / \dim_to_fp:n { \l_lf_side_dim }
          }
        \lf_side_scale:n { \fp_use:N \l_lf_side_scale_fp }
      }
  }
\cs_new_protected:Npn \lf_side_scale:n #1
  {
    \int_step_inline:nn { \l_lf_side_count_int }
      { \box_scale:cnn { \lf_side_box:n {##1} } {#1} {#1} }
    \dim_set:Nn \l_lf_side_dim { \fp_to_dim:n { (#1) * \l_lf_side_dim } }
  }

% The row from the part boxes, which are kept. Each part is a \vtop whose
% baseline is the bottom of its image, so the images share a bottom line and
% the subcaptions hang below them.
\cs_new_protected:Npn \lf_side_row:
  {
    \bool_gset_true:N \g_lf_in_block_bool
    \hbox_set:Nn \l_lf_side_box
      {
        \int_step_inline:nn { \l_lf_side_count_int }
          {
            \int_compare:nNnT {##1} > { 1 } { \skip_horizontal:N \l_lf_side_gap_dim }
            \vtop
              {
                \hsize = \box_wd:c { \lf_side_box:n {##1} }
                \linewidth = \hsize
                \box_use:c { \lf_side_box:n {##1} }
                \tl_if_blank:VF \g_lf_subcaption_tl
                  {
                    \skip_vertical:n { \l_lf_subcaption_gap_tl \g_lf_line_dim }
                    \nointerlineskip
                    \lf_caption_leading:
                    \lf_subcaption:nn {##1}
                      { \int_compare:nNnT {##1} > { \seq_count:N \l_lf_side_subcaption_seq } { } \seq_item:Nn \l_lf_side_subcaption_seq {##1} }
                  }
              }
          }
      }
    \bool_gset_false:N \g_lf_in_block_bool
    \dim_set:Nn \l_lf_caption_dim
      { \dim_min:nn { \linewidth } { \dim_max:nn { \box_wd:N \l_lf_side_box } { 0.5 \linewidth } } }
  }

\cs_new_protected:Npn \lf_side:nn #1#2   % graphics or plot, files
  {
    \lf_caption_kind:n {#1}
    \lf_block_before:nn { \l_lf_block_space_int } { \l_lf_block_gap_int }
    \seq_set_from_clist:Nn \l_lf_side_files_seq {#2}
    \seq_set_from_clist:NV \l_lf_side_subcaption_seq \g_lf_subcaption_tl
    \int_set:Nn \l_lf_side_count_int { \seq_count:N \l_lf_side_files_seq }
    \dim_set_eq:NN \l_lf_side_gap_dim \l_lf_sub_figure_gap_dim
    % Each image is set with the width key, or an equal share of the line.
    % An image given only a height keeps it, so the row has one height.
    \tl_set_eq:NN \l_lf_side_width_tl \g_lf_width_tl
    \bool_lazy_and:nnT
      { \tl_if_blank_p:V \g_lf_width_tl }
      { ! ( \str_if_eq_p:nn {#1} { graphics } && ! \tl_if_blank_p:V \g_lf_height_tl ) }
      {
        \tl_gset:Ne \g_lf_width_tl
          {
            \dim_eval:n
              { ( \linewidth - \int_eval:n { \l_lf_side_count_int - 1 } \l_lf_side_gap_dim ) / \l_lf_side_count_int }
          }
      }
    \lf_side_parts:n {#1}
    \lf_side_row:
    \tl_gset_eq:NN \g_lf_width_tl \l_lf_side_width_tl
    \tl_if_blank:VF \g_lf_caption_tl { \refstepcounter { figure } }
    \vbox_gset:Nn \g_lf_block_box
      {
        \hsize = \linewidth
        \hbox_to_wd:nn { \linewidth } { \hfil \box_use_drop:N \l_lf_side_box \hfil }
        \lf_unit_caption:n { \lf_side_labels: }
      }
    \lf_unit_put:nn { \l_lf_block_space_int } { \lf_unit_min: }
  }
\cs_generate_variant:Nn \seq_set_from_clist:Nn { NV }
\cs_generate_variant:Nn \box_scale:Nnn { c }
\cs_generate_variant:Nn \msg_warning:nnnnn { nneee }

% "(a) text", centred under its image, in the caption colour.
\cs_new_protected:Npn \lf_subcaption:nn #1#2   % index, text
  {
    \group_begin:
      \parindent = \c_zero_dim
      \leftskip = \c_zero_dim plus 1fil
      \rightskip = \c_zero_dim plus 1fil
      \parfillskip = \c_zero_dim
      \interlinepenalty = 10000
      \noindent
      \bool_if:NTF \l_lf_caption_theme_bool { \color { lfTheme } } { \color { \l_lf_caption_color_tl } }
      \textbf { ( \int_to_alph:n {#1} ) }
      \tl_if_blank:nF {#2} { ~ #2 }
      \par
    \group_end:
  }

% The labels x[1], x[2], ... of the parts, each with its number and letter.
\cs_new_protected:Npn \lf_side_labels:
  {
    \tl_if_blank:VF \g_lf_label_tl
      {
        \int_step_inline:nn { \l_lf_side_count_int }
          {
            \group_begin:
              \protected@edef \@currentlabel { \thefigure \int_to_alph:n {##1} }
              \tl_set:Ne \l_lf_side_label_tl { \exp_not:V \g_lf_label_tl [ ##1 ] }
              \lf_label:Vn \l_lf_side_label_tl { figure }
            \group_end:
          }
      }
  }

\NewDocumentCommand \myfigure { O{} m }
  {
    \lf_keys:nnn { myfigure } { label, caption, subcaption, width, height, caption-align, hyphenate } {#1}
    \lf_check_subcaption:nn { myfigure } {#2}
    \lf_default_label:ne { fig } { \clist_item:nn {#2} { 1 } }
    \lf_place_figure:nn { graphics } {#2}
  }

% Plot defaults, from the plot-* settings: boxed axes with ticks on all sides
% pointing in, equal padding between data and frame on all four sides
% (plot-padding, a fraction of each axis range), a legend set in from its
% corner by the same amount, one line width, minor ticks, and a black cycle (solid, dashed,
% dotted, dash-dot) that stays readable in greyscale. A plot file sets only
% what is specific to it; its own options override these.
\cs_new_protected:Npn \lf_apply_plots:
  {
    \use:e
      {
        \exp_not:N \pgfplotsset
          {
            every~axis/.append~style =
              {
                axis~lines = box,
                enlarge~x~limits = \l_lf_plot_padding_tl,
                enlarge~y~limits = \l_lf_plot_padding_tl,
                axis~line~style = { line~width = \l_lf_plot_axis_tl },
                tick~style = { line~width = \l_lf_plot_axis_tl },
                tick~pos = both,
                tick~align = inside,
                major~tick~length = \dim_use:N \l_lf_plot_tick_dim,
                minor~tick~length = \dim_eval:n { 0.5 \l_lf_plot_tick_dim },
                minor~tick~num = \int_use:N \l_lf_plot_minor_int,
                grid = \l_lf_plot_grid_tl,
                major~grid~style = { line~width = 0.3pt, black!25 },
                minor~grid~style = { line~width = 0.2pt, black!15 },
                tick~label~style = { font = \exp_not:N \footnotesize },
                label~style = { font = \exp_not:N \small },
                \str_case:VnF \l_lf_plot_legend_tl
                  {
                    { north~west } { legend~style = { at = {(0.04,0.96)}, anchor = north~west } }
                    { north~east } { legend~style = { at = {(0.96,0.96)}, anchor = north~east } }
                    { south~west } { legend~style = { at = {(0.04,0.04)}, anchor = south~west } }
                    { south~east } { legend~style = { at = {(0.96,0.04)}, anchor = south~east } }
                  }
                  { legend~pos = \l_lf_plot_legend_tl },
                legend~style = { font = \exp_not:N \footnotesize, draw = black, line~width = \l_lf_plot_axis_tl, cells = { anchor = west } },
              },
            every~axis~plot/.append~style = { line~width = \l_lf_plot_line_tl, mark~size = \l_lf_plot_mark_tl },
          }
      }
    \str_if_eq:VnT \l_lf_plot_colors_tl { black }
      {
        % Plain styles per plot number: black, then dashed, dotted, dash-dot...
        \pgfplotsset
          {
            every~axis~plot/.append~style = { black },
            every~axis~plot~no~1/.append~style = { dashed },
            every~axis~plot~no~2/.append~style = { dotted },
            every~axis~plot~no~3/.append~style = { dash~dot },
            every~axis~plot~no~4/.append~style = { loosely~dashed },
            every~axis~plot~no~5/.append~style = { densely~dotted },
          }
      }
  }

\NewDocumentCommand \myplot { O{} m }
  {
    \lf_keys:nnn { myplot } { label, caption, subcaption, width, height, caption-align, hyphenate } {#1}
    \lf_check_subcaption:nn { myplot } {#2}
    \lf_default_label:ne { plot } { \clist_item:nn {#2} { 1 } }
    \lf_place_figure:nn { plot } {#2}
  }


% ========================================
% EQUATIONS AND REACTIONS
% ========================================
\box_new:N \l_lf_math_box
\box_new:N \l_lf_formula_box
\int_new:N \g_lf_formula_row_int
\tl_new:N \g_lf_formula_label_tl
\tl_new:N \l_lf_formula_row_label_tl
\cs_new_eq:NN \lf_saved_make_display_tag: \make@display@tag

% amsmath calls this once for each numbered row of align, after its measuring
% pass. Label the row before amsmath advances the equation counter and writes
% the pending label. A \nonumber row has no tag and is not counted.
\cs_new_protected:Npn \lf_formula_display_tag:
  {
    \ifmeasuring@\else
      \if@eqnsw
        \int_gincr:N \g_lf_formula_row_int
        \tl_if_blank:VF \g_lf_formula_label_tl
          {
            \tl_set:Ne \l_lf_formula_row_label_tl
              { \exp_not:V \g_lf_formula_label_tl [ \int_use:N \g_lf_formula_row_int ] }
            \lf_label:Vn \l_lf_formula_row_label_tl { equation }
          }
      \fi
    \fi
    \lf_saved_make_display_tag:
  }

\cs_new_protected:Npn \lf_formula:n #1
  {
    \tl_gset:NV \g_lf_formula_label_tl \g_lf_label_tl
    \bool_set_true:N \l_lf_math_measure_bool
    \lf_block_before:nn { \l_lf_math_space_int } { \l_lf_math_space_int }
    \bool_set_false:N \l_lf_math_measure_bool
    \int_gzero:N \g_lf_formula_row_int
    % The display sits in a paragraph whose empty first and last lines are
    % removed, so the box holds only the rows: the first line is split off
    % at a forced break, the last taken off with the space before it.
    \bool_gset_true:N \g_lf_in_block_bool
    \vbox_set:Nn \l_lf_formula_box
      {
        \hsize = \linewidth
        \abovedisplayskip = 0pt
        \belowdisplayskip = 0pt
        \abovedisplayshortskip = 0pt
        \belowdisplayshortskip = 0pt
        \cs_set:Npn \tagform@ ##1 { \maketag@@@ { ( \textbf {##1} ) } }
        \cs_set_eq:NN \make@display@tag \lf_formula_display_tag:
        \noindent \vadjust { \penalty -10000 }
        \begin{align} #1 \end{align}
        \par
        \box_set_to_last:N \l_tmpa_box
        \prg_replicate:nn { 4 } { \tex_unskip:D \tex_unpenalty:D }
      }
    \bool_gset_false:N \g_lf_in_block_bool
    \group_begin:
      \tex_splittopskip:D = \c_zero_skip
      \vbox_set_split_to_ht:NNn \l_tmpa_box \l_lf_formula_box { \c_zero_dim }
      \box_gset_eq:NN \g_lf_block_box \l_lf_formula_box
    \group_end:
    % amsmath sets every row at least a strut high (0.7 and 0.3 of a line).
    % Where the first or last row is just the strut, its ink is measured as
    % capitals and descenders, so a formula is spaced like a reaction.
    \dim_compare:nNnT { \dim_abs:n { \box_ht:N \g_lf_block_box - 0.7 \g_lf_line_dim } } < { 0.05pt }
      { \dim_set:Nn \l_lf_unit_top_dim { 0.7 \g_lf_line_dim - \fontcharht \font `X } }
    \dim_compare:nNnT { \dim_abs:n { \box_dp:N \g_lf_block_box - 0.3 \g_lf_line_dim } } < { 0.05pt }
      { \dim_set:Nn \l_lf_unit_bottom_dim { 0.3 \g_lf_line_dim - \fontchardp \font `p } }
    \lf_formula_width:n {#1}
    \tl_if_blank:VF \g_lf_formula_label_tl
      {
        \int_compare:nNnT { \g_lf_formula_row_int } > { 0 }
          {
            \cs_gset:cpx { lf@formula@count@\g_lf_formula_label_tl }
              { \int_use:N \g_lf_formula_row_int }
            \protected@write \@auxout { }
              {
                \string\lf@formula@group
                  { \g_lf_formula_label_tl } { \int_use:N \g_lf_formula_row_int }
              }
            \protected@edef \@currentlabel
              {
                \exp_not:N \lf@formula@numbers
                  { \exp_not:V \g_lf_formula_label_tl }
                  { \int_use:N \g_lf_formula_row_int }
              }
            \label { \g_lf_formula_label_tl }
          }
      }
    \lf_unit_put:nn { \l_lf_math_space_int } { \c_zero_dim }
  }

% #1 counter (equation, lfreaction or empty), #2 reference kind, #3 math
\cs_new_protected:Npn \lf_math:nnn #1#2#3
  {
    \bool_set_true:N \l_lf_math_measure_bool
    \lf_block_before:nn { \l_lf_math_space_int } { \l_lf_math_space_int }
    \bool_set_false:N \l_lf_math_measure_bool
    \hbox_set:Nn \l_lf_math_box { $ \displaystyle #3 $ }
    \dim_set:Nn \l_lf_math_wd_dim { \box_wd:N \l_lf_math_box }
    \vbox_gset:Nn \g_lf_block_box
      {
        \hsize = \linewidth
        \tl_if_empty:nF {#1}
          {
            \refstepcounter {#1}
            \tl_if_blank:VF \g_lf_label_tl { \lf_label:Vn \g_lf_label_tl {#2} }
          }
        \hbox_to_wd:nn { \hsize }
          {
            \hfil \box_use_drop:N \l_lf_math_box \hfil
            \tl_if_empty:nF {#1} { \llap { \textbf { ( \use:c { the #1 } ) } } }
          }
      }
    \lf_unit_put:nn { \l_lf_math_space_int } { \c_zero_dim }
  }

\NewDocumentCommand \myformula { O{} m }
  {
    \lf_keys:nnn { myformula } { label } {#1}
    \lf_place:n { \lf_formula:n {#2} }
  }

\NewDocumentCommand \myequation { O{} m }
  {
    \lf_keys:nnn { myequation } { } {#1}
    \lf_place:n { \lf_math:nnn { } { } { \begin{aligned} #2 \end{aligned} } }
  }

% A reaction with \\ in it is a set of aligned rows, as in \myequation: the
% chemistry goes in \ce{...}, & aligns the rows (a ΔH row under the
% reaction, say) and \nonumber is ignored. The whole reaction takes one
% number, on its last row. Without \\ the argument is a single \ce formula.
\cs_new_protected:Npn \lf_reaction_rows:n #1
  {
    \cs_set_eq:NN \nonumber \scan_stop:
    \cs_set_eq:NN \notag \scan_stop:
    \begin{aligned}[b] #1 \end{aligned}
  }

\NewDocumentCommand \myreaction { O{} m }
  {
    \lf_keys:nnn { myreaction } { label } {#1}
    \tl_if_in:nnTF {#2} { \\ }
      { \lf_place:n { \lf_math:nnn { lfreaction } { reaction } { \lf_reaction_rows:n {#2} } } }
      { \lf_place:n { \lf_math:nnn { lfreaction } { reaction } { \ce {#2} } } }
  }


% ========================================
% TABLES
% ========================================
% A table file in tables/ holds its columns, header and rows:
%
%   \begin{labtable}{l c c r}
%       \tablehead{Sample & Mass (g) & Time (min) & Yield (\%)}
%       A1 & 2.013 & 11 & 87.0 \\
%   \end{labtable}
%
% While \mytable reads the file, \begin{labtable}{...} means \tablecolumns{...}
% and \end{labtable} expands to nothing: the rows are cells of an \halign,
% whose groups an environment's own group would cut across. The file is still
% \input, so TeX reports errors at its own lines. Other environments work as
% usual. The older form, \tablecolumns{...} without the environment, also works.
%
% Every row is its own line of text, so a long table breaks between rows
% across columns and pages. Rows sit on the line grid and rules take no
% height, so the text after the table stays on the grid.
%
% A column may carry a width in brackets, relative to the others: in
% {l[0.6] c c[2]} the last column is twice as wide as the second and the first
% 0.6 of it. With any width given, every column gets a fixed share of the
% table's width (one without a width counts as 1) and text longer than its
% column wraps onto more lines; each line is a line of the grid. Without
% widths, columns take their natural width and the gaps between them grow to
% fill the table, or shrink to a quarter when it is too wide.
%
% The header row is repeated where a table continues in a new column or on
% a new page. Each row records its page and height on the page in the .aux
% file; on the next run a row that sits higher than the row before it, or
% on a later page, gets the header in front of it. latexmk reruns until the
% positions settle.
\tl_new:N   \l_lf_preamble_tl
\bool_new:N \l_lf_first_column_bool
\dim_new:N  \l_lf_table_width_dim
\dim_new:N  \l_lf_table_top_dim
\dim_new:N  \l_lf_table_c_dim
\dim_new:N  \l_lf_table_after_dim
\box_new:N  \l_lf_table_caption_box
\bool_new:N \l_lf_table_caption_bool
\dim_new:N  \l_lf_row_dim
\skip_const:Nn \c_lf_column_skip { 1em plus 1fil minus 0.75em }
\seq_new:N  \l_lf_column_align_seq
\seq_new:N  \l_lf_column_weight_seq
\tl_new:N   \l_lf_column_align_tl
\tl_new:N   \l_lf_column_weight_tl
\bool_new:N \l_lf_column_bracket_bool
\bool_new:N \l_lf_weighted_bool
\fp_new:N   \l_lf_weight_sum_fp
\dim_new:N  \l_lf_weight_unit_dim
\int_new:N  \g_lf_table_int
\int_new:N  \g_lf_row_int
\int_new:N  \g_lf_aux_page_int
\int_new:N  \g_lf_aux_y_int
\bool_new:N \g_lf_header_row_bool
\tl_new:N   \g_lf_header_tl

\cs_if_exist:NTF \tex_pdfsavepos:D
  {
    \cs_new_eq:NN \lf_savepos: \tex_pdfsavepos:D
    \cs_new_eq:NN \lf_lastxpos: \tex_pdflastxpos:D
    \cs_new_eq:NN \lf_lastypos: \tex_pdflastypos:D
  }
  {
    \cs_new_eq:NN \lf_savepos: \tex_savepos:D
    \cs_new_eq:NN \lf_lastxpos: \tex_lastxpos:D
    \cs_new_eq:NN \lf_lastypos: \tex_lastypos:D
  }

% Runs at the start of every row: numbers the data rows and records where
% each one lands, read back by \lf@rowpos from the .aux file.
\cs_new_protected:Npn \lf_row_mark:
  {
    \bool_if:NF \g_lf_header_row_bool
      {
        \int_gincr:N \g_lf_row_int
        \lf_savepos:
        \use:e
          {
            \tex_write:D \exp_not:N \@auxout
              {
                \exp_not:N \lf@rowpos
                  { \int_use:N \g_lf_table_int } { \int_use:N \g_lf_row_int }
                  { \exp_not:N \the \exp_not:N \c@page } { \exp_not:N \the \exp_not:N \lf_lastypos: }
              }
          }
      }
  }

\cs_new_protected:Npn \lf@rowpos #1#2#3#4
  {
    \int_compare:nNnT {#2} > { 1 }
      {
        \bool_lazy_or:nnT
          { \int_compare_p:nNn {#3} > { \g_lf_aux_page_int } }
          { \int_compare_p:nNn {#4} > { \g_lf_aux_y_int + 65536 } }
          { \cs_gset:cpn { lf@break@#1@#2 } { } }
      }
    \int_gset:Nn \g_lf_aux_page_int {#3}
    \int_gset:Nn \g_lf_aux_y_int {#4}
  }

% Expands to the header row when the next row starts a new column or page.
\cs_new:Npn \lf_header_if_needed:
  {
    \cs_if_exist:cT
      { lf@break@ \int_use:N \g_lf_table_int @ \int_eval:n { \g_lf_row_int + 1 } }
      { \tl_if_empty:NF \g_lf_header_tl { \lf_header_row: } }
  }
\cs_new:Npn \lf_header_row:
  {
    \noalign { \bool_gset_true:N \g_lf_header_row_bool }
    \g_lf_header_tl \cr
    \noalign
      {
        \bool_gset_false:N \g_lf_header_row_bool
        \lf_table_rule:n { 0.4pt }
        \nobreak
      }
  }

\cs_new:Npn \lf_cell_l: { \strut \ignorespaces ## \unskip \hfil }
\cs_new:Npn \lf_cell_c: { \strut \hfil \ignorespaces ## \unskip \hfil }
\cs_new:Npn \lf_cell_r: { \strut \hfil \ignorespaces ## \unskip }

% A column with a width: a box of that width whose text wraps, ragged on the
% side away from its alignment. Its lines are lines of the row's spread, and
% with \lineskip at zero a row of k lines is k lines high, so the next row
% stays on the grid.
\cs_new:Npn \lf_cell_wide:nn #1#2 { \lf_cell_wide_begin:nn {#1} {#2} \ignorespaces ## \unskip \lf_cell_wide_end: }
\cs_new_protected:Npn \lf_cell_wide_begin:nn #1#2
  {
    \vtop \c_group_begin_token
      \hsize = #2 \linewidth = #2 \tex_parshape:D = 0 ~
      \parindent = \c_zero_dim \everypar = { } \hangindent = \c_zero_dim
      \str_case:nn {#1}
        {
          { l } { \leftskip = \c_zero_skip \rightskip = 0pt plus 1fil \parfillskip = 0pt plus 1fil }
          { c } { \leftskip = 0pt plus 1fil \rightskip = 0pt plus 1fil \parfillskip = \c_zero_skip }
          { r } { \leftskip = 0pt plus 1fil \rightskip = \c_zero_skip \parfillskip = \c_zero_skip }
        }
      \noindent \strut
  }
\cs_new_protected:Npn \lf_cell_wide_end: { \strut \par \c_group_end_token }

\msg_new:nnn { labforge } { table-column }
  { Table~column~"#1"~is~not~l,~c~or~r;~it~is~set~as~l. }
\msg_new:nnn { labforge } { table-column-width }
  { Table~column~width~"#1"~is~not~a~positive~number~such~as~0.5~or~2;~it~is~set~as~1. }

% The columns of a \tablecolumns argument as two lists: l, c or r, and the
% width in brackets after it (empty when there is none).
\cs_new_protected:Npn \lf_column_flush:
  {
    \tl_if_empty:NF \l_lf_column_align_tl
      {
        \seq_put_right:NV \l_lf_column_align_seq \l_lf_column_align_tl
        \seq_put_right:NV \l_lf_column_weight_seq \l_lf_column_weight_tl
      }
    \tl_clear:N \l_lf_column_align_tl
    \tl_clear:N \l_lf_column_weight_tl
  }
\cs_new_protected:Npn \lf_read_columns:n #1
  {
    \seq_clear:N \l_lf_column_align_seq
    \seq_clear:N \l_lf_column_weight_seq
    \tl_clear:N \l_lf_column_align_tl
    \tl_clear:N \l_lf_column_weight_tl
    \bool_set_false:N \l_lf_column_bracket_bool
    \tl_map_inline:nn {#1}
      {
        \bool_if:NTF \l_lf_column_bracket_bool
          {
            \str_if_eq:nnTF {##1} { ] }
              { \bool_set_false:N \l_lf_column_bracket_bool }
              { \tl_put_right:Nn \l_lf_column_weight_tl {##1} }
          }
          {
            \str_if_eq:nnTF {##1} { [ }
              { \bool_set_true:N \l_lf_column_bracket_bool }
              { \lf_column_flush: \tl_set:Nn \l_lf_column_align_tl {##1} }
          }
      }
    \lf_column_flush:
    \bool_set_false:N \l_lf_weighted_bool
    \fp_zero:N \l_lf_weight_sum_fp
    \seq_set_eq:NN \l_tmpa_seq \l_lf_column_weight_seq
    \seq_clear:N \l_lf_column_weight_seq
    \seq_map_inline:Nn \l_tmpa_seq
      {
        \tl_set:Nn \l_tmpb_tl { 1 }
        \tl_if_blank:nF {##1}
          {
            \regex_match:nnTF { \A \s* \d* \.? \d+ \s* \Z } {##1}
              {
                \fp_compare:nNnTF {##1} > { 0 }
                  { \bool_set_true:N \l_lf_weighted_bool \tl_set:Nn \l_tmpb_tl {##1} }
                  { \msg_warning:nnn { labforge } { table-column-width } {##1} }
              }
              { \msg_warning:nnn { labforge } { table-column-width } {##1} }
          }
        \seq_put_right:NV \l_lf_column_weight_seq \l_tmpb_tl
        \fp_add:Nn \l_lf_weight_sum_fp { \l_tmpb_tl }
      }
  }

% A rule of thickness #1 that takes no height: it is drawn over the bottom
% of the row above.
\cs_new_protected:Npn \lf_table_rule:n #1
  {
    \kern - #1
    \nointerlineskip
    \hbox_to_wd:nn { \linewidth }
      { \skip_horizontal:n { \l_lf_lead_dim } \tex_vrule:D width \l_lf_table_width_dim height #1 depth \c_zero_dim \hss }
    \tex_prevdepth:D = 0.3 \l_lf_row_dim
  }

% A thin rule between the rows of a table, drawn like the rule under the
% header, used as \tablerule before summary rows such as the mean.
\NewExpandableDocumentCommand \tablerule { } { \noalign { \lf_table_rule:n { 0.4pt } } }

% One column of the \halign preamble, and the gap after it.
\cs_new_protected:Npn \lf_column_template:nn #1#2
  {
    \bool_if:NTF \l_lf_first_column_bool
      { \bool_set_false:N \l_lf_first_column_bool }
      { \tl_put_right:Nn \l_lf_preamble_tl { & } }
    \str_case:nnF {#1}
      { { l } { } { c } { } { r } { } }
      { \msg_warning:nnn { labforge } { table-column } {#1} }
    \tl_set:Ne \l_tmpa_tl { \str_case:nnF {#1} { { c } { c } { r } { r } } { l } }
    \bool_if:NTF \l_lf_weighted_bool
      {
        \tl_put_right:Ne \l_lf_preamble_tl
          { \exp_not:N \span \exp_not:N \lf_cell_wide:nn { \l_tmpa_tl } { \dim_eval:n { #2 \l_lf_weight_unit_dim } } \tabskip = 1em \scan_stop: }
      }
      { \tl_put_right:Ne \l_lf_preamble_tl { \exp_not:N \span \exp_not:c { lf_cell_ \l_tmpa_tl : } \tabskip = \exp_not:N \c_lf_column_skip } }
  }

\NewDocumentCommand \tablecolumns { m }
  {
    \int_gincr:N \g_lf_table_int
    \int_gzero:N \g_lf_row_int
    \tl_gclear:N \g_lf_header_tl
    \tl_set:Nn \l_lf_preamble_tl { \lf_row_mark: }
    \bool_set_true:N \l_lf_first_column_bool
    \lf_read_columns:n {#1}
    % With widths, the table's width less a 1 em gap between columns is shared by weight.
    \dim_set:Nn \l_lf_weight_unit_dim
      { \fp_to_dim:n { ( \l_lf_table_width_dim - ( \seq_count:N \l_lf_column_align_seq - 1 ) * 1em ) / \l_lf_weight_sum_fp } }
    \seq_map_pairwise_function:NNN \l_lf_column_align_seq \l_lf_column_weight_seq \lf_column_template:nn
    % Fixed columns may round past the table's width by a point; natural ones keep a fixed edge, so their gaps shrink.
    \bool_if:NTF \l_lf_weighted_bool
      { \tl_put_right:Nn \l_lf_preamble_tl { \tabskip = \l_lf_lead_dim plus 1fil minus 1pt } }
      { \tl_put_right:Nn \l_lf_preamble_tl { \tabskip = \l_lf_lead_dim } }
    \tabskip = \l_lf_lead_dim
    \use:e
      {
        \tex_halign:D to \dim_use:N \linewidth
        \c_group_begin_token
        \exp_not:V \l_lf_preamble_tl
        \exp_not:N \cr
      }
    \noalign
      {
        % The top rule sits just above the first row, which lands on a line.
        \dim_compare:nNnF { \prevdepth } < { -999pt } { \skip_vertical:n { -\prevdepth } }
        \nointerlineskip
        \vbox_to_ht:nn { \l_lf_table_top_dim }
          {
            \vss
            \bool_if:NT \l_lf_table_caption_bool
              {
                \box_set_dp:Nn \l_lf_table_caption_box { \c_zero_dim }
                \box_use_drop:N \l_lf_table_caption_box
                \skip_vertical:n { \l_lf_caption_gap_tl \g_lf_line_dim }
                \nointerlineskip
              }
            \hbox_to_wd:nn { \linewidth }
              {
                \skip_horizontal:n { \l_lf_lead_dim }
                \tex_vrule:D width \l_lf_table_width_dim height 0.8pt depth \c_zero_dim
                \hss
              }
          }
        \lf_write_tpos:nn { tstart } { \g_lf_table_int }
        \tex_prevdepth:D = -1000pt
      }
  }

\NewExpandableDocumentCommand \tablehead { m }
  {
    \noalign
      {
        \bool_gset_true:N \g_lf_header_row_bool
        \tl_gset:Nn \g_lf_header_tl {#1}
      }
    #1 \cr
    \noalign
      {
        \bool_gset_false:N \g_lf_header_row_bool
        \lf_table_rule:n { 0.4pt }
        \nobreak
      }
  }

% A table with its own spread has rows that are not whole lines, so the text after
% it would leave the line grid. The first row starts on the grid and the rows
% are contiguous, so the table's height D is known from two positions written
% to the .aux file (page, y from the page bottom, x of the column); the next
% run adds the glue that makes D a whole number of lines. A table that
% continues in another column or on another page is left as it is.
\cs_new_protected:Npn \lf_write_tpos:nn #1#2
  {
    \lf_savepos:
    \use:e
      {
        \tex_write:D \exp_not:N \@auxout
          {
            \exp_not:c { lf@#1 } { \int_eval:n {#2} }
              { \exp_not:N \the \exp_not:N \c@page } { \exp_not:N \the \exp_not:N \lf_lastypos: }
              { \exp_not:N \the \exp_not:N \lf_lastxpos: }
          }
      }
  }
\cs_new_protected:Npn \lf_store_tpos:nnnnn #1#2#3#4#5
  {
    \cs_gset:cpn { lf@#1@page@#2 } {#3}
    \cs_gset:cpn { lf@#1@y@#2 } {#4}
    \cs_gset:cpn { lf@#1@x@#2 } {#5}
  }
\cs_new_protected:Npn \lf@tstart #1#2#3#4 { \lf_store_tpos:nnnnn { tstart } {#1} {#2} {#3} {#4} }
\cs_new_protected:Npn \lf@tend #1#2#3#4   { \lf_store_tpos:nnnnn { tend } {#1} {#2} {#3} {#4} }

% Whether table #1 started and ended in different columns or pages.
\prg_new_conditional:Npnn \lf_table_broken:n #1 { T }
  {
    \bool_lazy_and:nnTF
      { \cs_if_exist_p:c { lf@tstart@page@#1 } }
      { \cs_if_exist_p:c { lf@tend@page@#1 } }
      {
        \int_compare:nNnTF { \use:c { lf@tstart@page@#1 } } = { \use:c { lf@tend@page@#1 } }
          {
            \int_compare:nNnTF { \use:c { lf@tstart@x@#1 } } = { \use:c { lf@tend@x@#1 } }
              { \prg_return_false: } { \prg_return_true: }
          }
          { \prg_return_true: }
      }
      { \prg_return_false: }
  }

% Glue after table #1 that brings the text below it back onto the grid.
\cs_new_protected:Npn \lf_table_pad:n #1
  {
    \bool_lazy_all:nT
      {
        { \cs_if_exist_p:c { lf@tstart@y@#1 } }
        { \cs_if_exist_p:c { lf@tend@y@#1 } }
        { \int_compare_p:nNn { \use:c { lf@tstart@page@#1 } } = { \use:c { lf@tend@page@#1 } } }
        { \int_compare_p:nNn { \use:c { lf@tstart@x@#1 } } = { \use:c { lf@tend@x@#1 } } }
        { \int_compare_p:nNn { \use:c { lf@tstart@y@#1 } } > { \use:c { lf@tend@y@#1 } } }
      }
      {
        \int_set:Nn \l_tmpa_int
          { \int_mod:nn { \use:c { lf@tstart@y@#1 } - \use:c { lf@tend@y@#1 } } { \dim_to_decimal_in_sp:n { \g_lf_line_dim } } }
        % Within about a tenth of a point of a whole line is a whole line.
        \int_compare:nNnT { \l_tmpa_int } > { 6554 }
          {
            \int_compare:nNnT { \l_tmpa_int } < { \dim_to_decimal_in_sp:n { \g_lf_line_dim } - 6554 }
              { \skip_vertical:n { \dim_eval:n { \g_lf_line_dim } - \l_tmpa_int sp } }
          }
      }
  }

\cs_new_protected:Npn \lf_table:n #1
  {
    \lf_block_before:nn { \l_lf_block_space_int } { \l_lf_block_gap_int }
    \lf_width:NN \l_lf_table_width_dim \g_lf_width_tl
    \dim_set:Nn \l_lf_lead_dim { ( \linewidth - \l_lf_table_width_dim ) / 2 }
    % The caption (if any), caption-gap and the top rule form the top of the
    % table: c is their height from the caption's top to the rule.
    \lf_snap_set:
    \tl_if_blank:VTF \g_lf_caption_tl
      {
        \bool_set_false:N \l_lf_table_caption_bool
        \dim_zero:N \l_lf_table_c_dim
      }
      {
        \refstepcounter { table }
        \vbox_set:Nn \l_lf_table_caption_box
          {
            \hsize = \linewidth
            \lf_caption_leading:
            \tl_set:Nn \l_lf_caption_kind_tl { table }
            \lf_caption:nnn { table } { \thetable }
              { \lf_label:Vn \g_lf_label_tl { table } \g_lf_caption_tl }
          }
        % The gap is measured from the caption's last baseline.
        \dim_set:Nn \l_lf_table_c_dim
          { \box_ht:N \l_lf_table_caption_box + \l_lf_caption_gap_tl \g_lf_line_dim }
        \bool_set_true:N \l_lf_table_caption_bool
      }
    % The rows are whole lines, the first baseline 0.7 of a line under the top
    % rule and the bottom rule 0.3 under the last. So with the top rule
    % top-dim below the baseline before and skip-after added under the table,
    % the white above is top-dim - c and the white below 0.7 of a line
    % + skip-after - the capital height.
    \dim_set:Nn \l_tmpb_dim { 0.7 \g_lf_line_dim - \fontcharht \font `X }
    \str_if_eq:VnTF \l_lf_snap_use_tl { off }
      {
        % Exactly the block white above and below.
        \dim_set:Nn \l_lf_table_top_dim { \lf_unit_min: + \l_lf_table_c_dim }
        \dim_set:Nn \l_lf_table_after_dim { \lf_unit_min: - \l_tmpb_dim }
      }
      {
        % Equal white above and below, at least the block white, with the text
        % after the table on the grid.
        \int_set:Nn \l_tmpa_int
          {
            \int_max:nn { 0 }
              {
                \fp_eval:n
                  {
                    ceil ( \dim_to_fp:n { \lf_unit_min: + \lf_unit_min: + \l_lf_table_c_dim + \fontcharht \font `X } / \dim_to_fp:n { \lf_snap_step: } - 0.0001 )
                  }
              }
          }
        % The next baseline is top-dim + skip-after + 0.7 of a line below the
        % last one before the rows, so that is whole steps.
        \dim_set:Nn \l_lf_table_top_dim
          { ( \lf_snap_step: * \l_tmpa_int + \l_lf_table_c_dim - \fontcharht \font `X ) / 2 }
        \dim_set:Nn \l_lf_table_after_dim
          { \l_lf_table_top_dim - \l_lf_table_c_dim - \l_tmpb_dim }
        % A table that went on in another column or page (known from the
        % previous run) ends on the grid there: under it, only whole steps.
        \lf_table_broken:nT { \int_eval:n { \g_lf_table_int + 1 } }
          {
            \dim_set:Nn \l_lf_table_after_dim
              {
                \lf_snap_step: *
                \int_max:nn { 0 }
                  { \fp_eval:n { ceil ( \dim_to_fp:n { \lf_unit_min: - \l_tmpb_dim } / \dim_to_fp:n { \lf_snap_step: } - 0.0001 ) } }
              }
          }
      }
    \group_begin:
      \small
      % A row is one line of the report's spread; spread= sets the rows' own, in the same units as line-spread.
      \dim_set_eq:NN \l_lf_row_dim \g_lf_line_dim
      \tl_if_blank:VF \g_lf_spread_tl
        { \dim_set:Nn \l_lf_row_dim { \fp_to_dim:n { \dim_to_fp:n { \g_lf_line_dim } * \g_lf_spread_tl / \l_lf_spread_tl } } }
      \baselineskip = \l_lf_row_dim
      \lineskip = \c_zero_skip
      \lineskiplimit = \c_zero_dim
      \hbox_set:Nn \strutbox
        { \tex_vrule:D height 0.7 \l_lf_row_dim depth 0.3 \l_lf_row_dim width \c_zero_dim }
      \cs_set:Npn \\ { \cr \lf_header_if_needed: }
      \IfFileExists { tables/#1 }
        { \lf_table_file:n {#1} }
        { \msg_error:nnn { labforge } { missing-table } {#1} }
      \crcr
      \noalign { \lf_table_rule:n { 0.8pt } }
      \c_group_end_token
    \group_end:
    \tex_prevdepth:D = 0.3 \g_lf_line_dim
    \lf_write_tpos:nn { tend } { \g_lf_table_int }
    \tl_if_blank:VF \g_lf_spread_tl
      { \lf_table_pad:n { \int_use:N \g_lf_table_int } }
    \skip_vertical:N \l_lf_table_after_dim
    \lf_block_after:n { \l_lf_block_space_int }
  }

\msg_new:nnn { labforge } { missing-table }
  { Table~file~tables/#1~was~not~found. }

% Reads a table file, with labtable meaning \tablecolumns for its duration.
\cs_new_eq:NN \lf_saved_begin:w \begin
\cs_new_eq:NN \lf_saved_end:w \end
\cs_new_protected:Npn \lf_table_file:n #1
  {
    \cs_set_protected:Npn \begin ##1
      { \str_if_eq:nnTF {##1} { labtable } { \tablecolumns } { \lf_saved_begin:w {##1} } }
    % Expandable, so at the start of a row it leaves nothing before \crcr.
    \cs_set:Npn \end ##1
      { \str_if_eq:nnTF {##1} { labtable } { } { \lf_saved_end:w {##1} } }
    \tex_input:D { tables/#1 }
  }

\msg_new:nnn { labforge } { labtable-outside }
  { The~labtable~environment~belongs~in~a~table~file~in~tables/.~
    Write~\mytable{<file>}~in~the~document~instead. }
\NewDocumentEnvironment { labtable } { m }
  { \msg_error:nn { labforge } { labtable-outside } }
  { }

\NewDocumentCommand \mytable { O{} m }
  {
    \lf_keys:nnn { mytable } { label, caption, width, spread, caption-align, hyphenate } {#1}
    \lf_default_label:nn { tab } {#2}
    \lf_place:n { \lf_table:n {#2} }
  }


% ========================================
% HEADINGS
% ========================================
% \mysection I., \mysubsection I.I., \mysubsubsection I.I.I. One blank line
% before a heading (none between headings), none after.
\int_new:N \g_lf_heading_int
\tl_new:N  \l_lf_heading_number_tl

\cs_new_protected:Npn \lf_heading:nnn #1#2#3   % level 1 to 3, counter, title
  {
    \lf_wrap_clear:
    \par
    \bool_if:NF \g_lf_after_heading_bool
      {
        \bool_if:NTF \g_lf_after_block_bool
          {
            \int_compare:nNnT { \g_lf_last_unit_int } > { 0 }
              { \protected@write \@auxout { } { \string \lf@unitend { \int_use:N \g_lf_last_unit_int } } }
            \lf_skip_lines:n { 1 - \g_lf_trailing_int }
          }
          { \lf_skip_lines:n { 1 } }
      }
    \refstepcounter {#2}
    \int_compare:nNnT { \l_lf_number_depth_int } > {#1} { \lf_reset_numbers: }
    \tl_if_blank:VF \g_lf_label_tl
      {
        \lf_label:Vn \g_lf_label_tl { section }
        \protected@write \@auxout { } { \string \lf@reftitle { \g_lf_label_tl } {#3} }
      }
    \tl_set:Ne \l_lf_heading_number_tl { \use:c { the #2 } . }
    \int_gincr:N \g_lf_heading_int
    \pdfbookmark [ \int_eval:n { #1 - 1 } ]
      { \l_lf_heading_number_tl \c_space_tl #3 } { lfheading. \int_use:N \g_lf_heading_int }
    \group_begin:
      \bool_lazy_and:nnT
        { ! \l_lf_section_hang_bool }
        { \bool_lazy_and_p:nn { \l_lf_section_center_bool } { \int_compare_p:nNn {#1} = { 1 } } }
        { \centering }
      \addfontfeatures { LetterSpace = -2.0 }
      \noindent
      \bool_if:NTF \l_lf_section_hang_bool
        {
          \bool_if:NT \l_lf_section_numbers_bool
            {
              \makebox [ 0pt ] [ l ]
                { \addfontfeatures { LetterSpace = 0.0 } \textbf { \l_lf_heading_number_tl } }
            }
          \hspace* { \l_lf_indent_dim } \textbf {#3}
        }
        {
          \bool_if:NT \l_lf_section_numbers_bool
            { { \addfontfeatures { LetterSpace = 0.0 } \textbf { \l_lf_heading_number_tl } } ~ }
          \textbf {#3}
        }
      \par
    \group_end:
    \nobreak
    \bool_gset_true:N \g_lf_after_heading_bool
    \bool_gset_false:N \g_lf_after_block_bool
    \bool_gset_true:N \g_lf_heading_open_bool
    \int_gzero:N \g_lf_heading_lines_int
    \@afterindenttrue
    \@afterheading
  }

\NewDocumentCommand \mysection { O{} m }
  {
    \lf_keys:nnn { mysection } { label } {#1}
    \lf_heading:nnn { 1 } { section } {#2}
  }

\NewDocumentCommand \mysubsection { O{} m }
  {
    \lf_keys:nnn { mysubsection } { label } {#1}
    \lf_heading:nnn { 2 } { subsection } {#2}
  }

\NewDocumentCommand \mysubsubsection { O{} m }
  {
    \lf_keys:nnn { mysubsubsection } { label } {#1}
    \lf_heading:nnn { 3 } { subsubsection } {#2}
  }


% ========================================
% TITLE
% ========================================
% \myreport[header=, title=, author=, conducted=, submitted=, institution=]
% \mythesis[title=, subtitle=, author=, email=, orcid=, degree=, supervisor=, institution=, place=, date=]
% Both show only the keys given, centred across all columns. A value takes
% several lines with \\ (authors, institution and department).
\keys_define:nn { labforge / report }
  {
    header      .tl_gset:N = \g_lf_title_header_tl,
    title       .tl_gset:N = \g_lf_title_title_tl,
    author      .tl_gset:N = \g_lf_title_author_tl,
    conducted   .tl_gset:N = \g_lf_title_conducted_tl,
    submitted   .tl_gset:N = \g_lf_title_submitted_tl,
    institution .tl_gset:N = \g_lf_title_institution_tl,
  }
\keys_define:nn { labforge / thesis }
  {
    title       .tl_gset:N = \g_lf_title_title_tl,
    subtitle    .tl_gset:N = \g_lf_title_subtitle_tl,
    author      .tl_gset:N = \g_lf_title_author_tl,
    email       .tl_gset:N = \g_lf_title_email_tl,
    orcid       .tl_gset:N = \g_lf_title_orcid_tl,
    degree      .tl_gset:N = \g_lf_title_degree_tl,
    supervisor  .tl_gset:N = \g_lf_title_supervisor_tl,
    institution .tl_gset:N = \g_lf_title_institution_tl,
    place       .tl_gset:N = \g_lf_title_place_tl,
    date        .tl_gset:N = \g_lf_title_date_tl,
  }

\cs_new_protected:Npn \lf_title_clear:
  {
    \clist_map_inline:nn
      { header, title, subtitle, author, conducted, submitted, email, orcid, degree, supervisor, institution, place }
      { \tl_gclear_new:c { g_lf_title_ ##1 _tl } \tl_gclear:c { g_lf_title_ ##1 _tl } }
    \tl_gclear_new:N \g_lf_title_date_tl
    \tl_gset:Nn \g_lf_title_date_tl { \number\year }
  }

% A paragraph of one title key, then a blank line, when the key is not empty.
\cs_new_protected:Npn \lf_title_block:Nn #1#2
  {
    \tl_if_blank:VF #1 { #2 \par \lf_skip_lines:n { 1 } }
  }

\cs_new_protected:Npn \lf_report_title:
  {
    \par
    \group_begin:
      \centering
      \parindent = \c_zero_dim
      \lf_title_block:Nn \g_lf_title_header_tl { \g_lf_title_header_tl }
      \lf_title_block:Nn \g_lf_title_title_tl { \textbf { \g_lf_title_title_tl } }
      \lf_title_block:Nn \g_lf_title_author_tl { \g_lf_title_author_tl }
      \tl_if_blank:VF \g_lf_title_conducted_tl
        { \lf_text:n { conducted } ~ \g_lf_title_conducted_tl \par }
      \tl_if_blank:VF \g_lf_title_submitted_tl
        { \lf_text:n { submitted } ~ \g_lf_title_submitted_tl \par }
      \bool_lazy_or:nnT
        { ! \tl_if_blank_p:V \g_lf_title_conducted_tl }
        { ! \tl_if_blank_p:V \g_lf_title_submitted_tl }
        { \lf_skip_lines:n { 1 } }
      \lf_title_block:Nn \g_lf_title_institution_tl { \g_lf_title_institution_tl }
    \group_end:
    \bool_gset_true:N \g_lf_after_heading_bool
  }

\cs_new_protected:Npn \lf_thesis_title:
  {
    \par
    \group_begin:
      \centering
      \parindent = \c_zero_dim
      \lf_title_block:Nn \g_lf_title_title_tl { \group_begin: \large \bfseries \g_lf_title_title_tl \par \group_end: }
      \lf_title_block:Nn \g_lf_title_subtitle_tl { \g_lf_title_subtitle_tl }
      \lf_title_block:Nn \g_lf_title_author_tl { \g_lf_title_author_tl }
      \bool_lazy_or:nnT
        { ! \tl_if_blank_p:V \g_lf_title_email_tl }
        { ! \tl_if_blank_p:V \g_lf_title_orcid_tl }
        {
          \tl_if_blank:VF \g_lf_title_email_tl { EMAIL: ~ \tl_to_str:N \g_lf_title_email_tl }
          \bool_lazy_and:nnT
            { ! \tl_if_blank_p:V \g_lf_title_email_tl }
            { ! \tl_if_blank_p:V \g_lf_title_orcid_tl }
            { ,~ }
          \tl_if_blank:VF \g_lf_title_orcid_tl { ORCID: ~ \g_lf_title_orcid_tl }
          \par \lf_skip_lines:n { 1 }
        }
      \lf_title_block:Nn \g_lf_title_degree_tl { \g_lf_title_degree_tl }
      \lf_title_block:Nn \g_lf_title_supervisor_tl { \lf_text:n { supervisor } ~ \g_lf_title_supervisor_tl }
      \tl_if_blank:VF \g_lf_title_institution_tl { \g_lf_title_institution_tl \par }
      \tl_if_blank:VTF \g_lf_title_place_tl
        { \g_lf_title_date_tl }
        { \g_lf_title_place_tl ,~ \g_lf_title_date_tl }
      \par \lf_skip_lines:n { 1 }
    \group_end:
    \bool_gset_true:N \g_lf_after_heading_bool
  }

\NewDocumentCommand \myreport { O{} }
  {
    \lf_title_clear:
    \keys_set:nn { labforge / report } {#1}
    \lf_span:n { \lf_report_title: }
  }

\NewDocumentCommand \mythesis { O{} }
  {
    \lf_title_clear:
    \keys_set:nn { labforge / thesis } {#1}
    \lf_span:n { \lf_thesis_title: }
  }


% ========================================
% SPACING
% ========================================
\NewDocumentCommand \mylineskip { } { \vspace { \g_lf_line_dim } }

\ExplSyntaxOff


% ========================================
% BIBLIOGRAPHY
% ========================================
% The bibliography option makes biblatex read references.bib (data/references.bib in older projects), so latexmk
% runs biber; without it nothing runs and \mybibliography prints nothing. The
% list is printed where \mybibliography (or \printbibliography) is written,
% inside or after any columns; entries stay in English under a Greek main
% language. A class warning says when the option is on and no list is written.
\newif\iflf@printed
\iflf@bibliography\else
  \providecommand\printbibliography[1][]{}
\fi
\iflf@bibliography
  \ExplSyntaxOn
  \defbibheading { bibliography } [ \lf_text:n { references } ] { \mysection {#1} }
  \defbibenvironment { bibliography }
    {
      \list
        { \textbf { \printtext [ labelnumberwidth ] { \printfield { labelprefix } \printfield { labelnumber } } } }
        {
          \setlength \topsep { 0pt }
          \setlength \partopsep { 0pt }
          \setlength \labelwidth { \l_lf_indent_dim }
          \setlength \labelsep { 0pt }
          \setlength \leftmargin { 0pt }
          \setlength \itemindent { \l_lf_indent_dim }
          \setlength \itemsep { 0pt }
          \setlength \parsep { 0pt }
          \setlength \parskip { 0pt }
        }
      \cs_set:Npn \makelabel ##1 { ##1 \hss }
    }
    { \endlist }
    { \item }
  \ExplSyntaxOff
  \let\lf@printbibliography\printbibliography
  \ifx\lf@language\lf@greek
    \DeclareLanguageMapping{greek}{english}
    \let\lf@footfullcite\footfullcite
    \RenewDocumentCommand{\printbibliography}{O{}}{%
      \global\lf@printedtrue
      \begin{otherlanguage}{english}\lf@printbibliography[#1]\end{otherlanguage}}
    \RenewDocumentCommand{\footfullcite}{o o m}{%
      \begin{otherlanguage}{english}%
        \IfValueTF{#1}
          {\IfValueTF{#2}{\lf@footfullcite[#1][#2]{#3}}{\lf@footfullcite[#1]{#3}}}
          {\lf@footfullcite{#3}}%
      \end{otherlanguage}}
  \else
    \RenewDocumentCommand{\printbibliography}{O{}}{%
      \global\lf@printedtrue\lf@printbibliography[#1]}
  \fi
  \AtEndDocument{\iflf@printed\else
    \ClassWarning{labforge}{The~bibliography~option~is~on~but~no~\string\mybibliography~is~written}\fi}
\fi
\NewDocumentCommand\mybibliography{O{}}{\printbibliography[#1]}


\endinput
