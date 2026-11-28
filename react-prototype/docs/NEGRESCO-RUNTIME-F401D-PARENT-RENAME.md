# F4.01d — parent rename distinction

Combined CI 45735586917 at 6a949770bf1633697ed323124ce58268fae1b27e: Ubuntu 286/286, including 13/13 native Linux observations; Windows 285/286, native error parent-substitution:mutation-barrier. The precise Win32 error was not previously captured. Syntax repair allowed native execution. This is not a confirmed OS-sharing refusal yet.

The revised Windows fixture attempts the exact same parent rename before opening the leaf, while holding the leaf read handle, and (if blocked) after closing it. The held-handle rename uses MoveFileExW and captures GetLastError. If substitution succeeds, the reader must refuse the changed identity. If Windows returns 5/32/33, both control renames must succeed, the held read must match the expected bytes, original parent must remain in place and leaf identity must remain unchanged. Report explicitly distinguishes detected replacement from OS-blocked rename and its code. Other errors, missing mutation attempts or inconclusive evidence fail. A blocked mutation is not a successful detection of a completed substitution.

Native cases remain 13; Core expected 93 and combined 287 per OS including separate PowerShell syntax contract. Pending CI. No production permission, exhaustive race guarantee, real mod access, F1 gate waiver, merge or release.
