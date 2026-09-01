# VoiceInk Prompt Output

These tools generate and score the VoiceInk Default and Email prompt evaluation stored in `../artifacts/voiceink-prompt-output.json`. The React research site presents the same data at `#/prompt-output` through the public data mirror.

Selection is deterministic: 50 `email_formatting` cases use the Email prompt, while five cases from each other primary category use the Default prompt.

Generate results by running `node generate.mjs` and entering a Groq API key when prompted. Serve the directory with `python3 -m http.server 4173` and open `http://127.0.0.1:4173`.

Reference-based metrics use the same implementation as the earlier benchmark: RapidFuzz edit similarity, sacreBLEU chrF++ with word order 2, and jiwer WER. Run `score_results.py` with an environment containing those packages after generating outputs.
