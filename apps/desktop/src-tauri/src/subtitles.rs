use regex::Regex;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum SubtitleError {
    #[error("Failed to read file: {0}")]
    IoError(#[from] std::io::Error),
    #[error("Unsupported subtitle format: {0}")]
    UnsupportedFormat(String),
    #[error("Parse error: {0}")]
    ParseError(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Subtitle {
    pub id: String,
    #[serde(rename = "startTime")]
    pub start_time: f64,
    #[serde(rename = "endTime")]
    pub end_time: f64,
    pub text: String,
}

pub fn parse_subtitles(path: &str) -> Result<Vec<Subtitle>, SubtitleError> {
    let path = Path::new(path);
    let extension = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default();

    // Read file with encoding detection
    let content = read_with_encoding(path)?;

    match extension.as_str() {
        "srt" => parse_srt(&content),
        "vtt" => parse_vtt(&content),
        "ass" | "ssa" => parse_ass(&content),
        _ => Err(SubtitleError::UnsupportedFormat(extension)),
    }
}

fn read_with_encoding(path: &Path) -> Result<String, SubtitleError> {
    let bytes = fs::read(path)?;

    // Try UTF-8 first
    if let Ok(content) = String::from_utf8(bytes.clone()) {
        return Ok(content);
    }

    // Try common encodings
    let encodings = [
        encoding_rs::GB18030,
        encoding_rs::GBK,
        encoding_rs::BIG5,
        encoding_rs::UTF_16LE,
        encoding_rs::UTF_16BE,
    ];

    for encoding in encodings {
        let (decoded, _, had_errors) = encoding.decode(&bytes);
        if !had_errors {
            return Ok(decoded.into_owned());
        }
    }

    // Fallback: lossy UTF-8
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

fn parse_srt(content: &str) -> Result<Vec<Subtitle>, SubtitleError> {
    let mut subtitles = Vec::new();
    let blocks: Vec<&str> = content.split("\n\n").collect();

    let time_regex = Regex::new(r"(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})")
        .unwrap();

    for block in blocks {
        let lines: Vec<&str> = block.trim().lines().collect();
        if lines.len() < 3 {
            continue;
        }

        // First line is index (skip)
        // Second line is timing
        if let Some(caps) = time_regex.captures(lines[1]) {
            let start_time = parse_srt_time(&caps, 1);
            let end_time = parse_srt_time(&caps, 5);

            // Remaining lines are text
            let text: String = lines[2..]
                .iter()
                .map(|s| s.trim())
                .filter(|s| !s.is_empty())
                .collect::<Vec<_>>()
                .join("\n");

            if !text.is_empty() {
                subtitles.push(Subtitle {
                    id: format!("srt-{}", subtitles.len()),
                    start_time,
                    end_time,
                    text: clean_text(&text),
                });
            }
        }
    }

    Ok(subtitles)
}

fn parse_srt_time(caps: &regex::Captures, start: usize) -> f64 {
    let hours: f64 = caps[start].parse().unwrap_or(0.0);
    let minutes: f64 = caps[start + 1].parse().unwrap_or(0.0);
    let seconds: f64 = caps[start + 2].parse().unwrap_or(0.0);
    let millis: f64 = caps[start + 3].parse().unwrap_or(0.0);

    hours * 3600.0 + minutes * 60.0 + seconds + millis / 1000.0
}

fn parse_vtt(content: &str) -> Result<Vec<Subtitle>, SubtitleError> {
    let mut subtitles = Vec::new();
    let lines: Vec<&str> = content.lines().collect();

    let time_regex = Regex::new(r"(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})")
        .unwrap();
    let time_regex_short = Regex::new(r"(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2})\.(\d{3})")
        .unwrap();

    let mut i = 0;
    while i < lines.len() {
        let line = lines[i].trim();

        // Check for timestamp line
        if let Some(caps) = time_regex.captures(line) {
            let start_time = parse_srt_time(&caps, 1);
            let end_time = parse_srt_time(&caps, 5);

            // Collect text lines
            let mut text_lines = Vec::new();
            i += 1;
            while i < lines.len() && !lines[i].trim().is_empty() {
                text_lines.push(lines[i].trim());
                i += 1;
            }

            let text = text_lines.join("\n");
            if !text.is_empty() {
                subtitles.push(Subtitle {
                    id: format!("vtt-{}", subtitles.len()),
                    start_time,
                    end_time,
                    text: clean_text(&text),
                });
            }
        } else if let Some(caps) = time_regex_short.captures(line) {
            // Short format without hours
            let start_time = parse_vtt_short_time(&caps, 1);
            let end_time = parse_vtt_short_time(&caps, 4);

            let mut text_lines = Vec::new();
            i += 1;
            while i < lines.len() && !lines[i].trim().is_empty() {
                text_lines.push(lines[i].trim());
                i += 1;
            }

            let text = text_lines.join("\n");
            if !text.is_empty() {
                subtitles.push(Subtitle {
                    id: format!("vtt-{}", subtitles.len()),
                    start_time,
                    end_time,
                    text: clean_text(&text),
                });
            }
        }

        i += 1;
    }

    Ok(subtitles)
}

fn parse_vtt_short_time(caps: &regex::Captures, start: usize) -> f64 {
    let minutes: f64 = caps[start].parse().unwrap_or(0.0);
    let seconds: f64 = caps[start + 1].parse().unwrap_or(0.0);
    let millis: f64 = caps[start + 2].parse().unwrap_or(0.0);

    minutes * 60.0 + seconds + millis / 1000.0
}

fn parse_ass(content: &str) -> Result<Vec<Subtitle>, SubtitleError> {
    let mut subtitles = Vec::new();

    let time_regex = Regex::new(r"Dialogue:\s*\d+,(\d+):(\d{2}):(\d{2})\.(\d{2}),(\d+):(\d{2}):(\d{2})\.(\d{2}),([^,]*),([^,]*),(\d+),(\d+),(\d+),([^,]*),(.+)")
        .unwrap();

    for line in content.lines() {
        if let Some(caps) = time_regex.captures(line) {
            let start_time = parse_ass_time(&caps, 1);
            let end_time = parse_ass_time(&caps, 5);
            let text = caps.get(15).map(|m| m.as_str()).unwrap_or("");

            if !text.is_empty() {
                subtitles.push(Subtitle {
                    id: format!("ass-{}", subtitles.len()),
                    start_time,
                    end_time,
                    text: clean_ass_text(text),
                });
            }
        }
    }

    Ok(subtitles)
}

fn parse_ass_time(caps: &regex::Captures, start: usize) -> f64 {
    let hours: f64 = caps[start].parse().unwrap_or(0.0);
    let minutes: f64 = caps[start + 1].parse().unwrap_or(0.0);
    let seconds: f64 = caps[start + 2].parse().unwrap_or(0.0);
    let centis: f64 = caps[start + 3].parse().unwrap_or(0.0);

    hours * 3600.0 + minutes * 60.0 + seconds + centis / 100.0
}

fn clean_text(text: &str) -> String {
    // Remove HTML tags
    let html_regex = Regex::new(r"<[^>]+>").unwrap();
    let cleaned = html_regex.replace_all(text, "");

    // Remove extra whitespace
    cleaned.trim().to_string()
}

fn clean_ass_text(text: &str) -> String {
    // Remove ASS formatting codes like {\\pos(x,y)}, {\\an8}, etc.
    let ass_regex = Regex::new(r"\{[^}]*\}").unwrap();
    let cleaned = ass_regex.replace_all(text, "");

    // Replace \N with newline
    let cleaned = cleaned.replace("\\N", "\n").replace("\\n", "\n");

    cleaned.trim().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_srt_time() {
        let regex = Regex::new(r"(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})")
            .unwrap();
        let caps = regex.captures("00:01:23,456 --> 00:01:25,789").unwrap();
        let start = parse_srt_time(&caps, 1);
        assert!((start - 83.456).abs() < 0.001);
    }

    #[test]
    fn test_clean_ass_text() {
        let text = "{\\an8}Hello World\\N第二行";
        let cleaned = clean_ass_text(text);
        assert_eq!(cleaned, "Hello World\n第二行");
    }
}
