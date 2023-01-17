<?php

class SummaryEngineContent {
    public static function cut_at_paragraph($content, $wordcount) {
        $paragraphs = explode("\n", $content);
        $summary = "";
        $wordcount_remaining = $wordcount;
        foreach($paragraphs as $paragraph) {
            $words = explode(" ", $paragraph);
            $wordcount_remaining -= count($words);
            if ($wordcount_remaining <= 0) {
                $summary .= $paragraph . "\n";
                break;
            }
            $summary .= $paragraph . "\n";
        }
        return $summary;
    }

    public static function cut_at_wordcount($content, $wordcount) {
        $words = explode(" ", $content);
        $summary = "";
        $wordcount_remaining = $wordcount;
        foreach($words as $word) {
            $wordcount_remaining -= strlen($word);
            if ($wordcount_remaining <= 0) {
                $summary .= $word . " ";
                break;
            }
            $summary .= $word . " ";
        }
        return $summary;
    }
}