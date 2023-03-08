<?php

class SummaryEngineContent {
    public static function cut_at_paragraph($content, $wordcount) {
        if (empty($wordcount)) {
            $wordcount = 500;
        }
        if (empty($content)) {
            return "";
        }
        // $original_wordcount = count(explode(" ", $content));
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
        // error_log("cut_at_paragraph; Original wordcount: " . $original_wordcount . " | Summary wordcount: " . count(explode(" ", $summary)) . " | Summary paragraph count: " . count($paragraphs));
        return $summary;
    }

    public static function cut_at_wordcount($content, $wordcount) {
        if (empty($wordcount)) {
            $wordcount = 500;
        }
        if (empty($content)) {
            return "";
        }
        $words = explode(" ", $content);
        // $original_wordcount = count($words);
        $summary = "";
        $wordcount_remaining = $wordcount;
        foreach($words as $word) {
            $wordcount_remaining--;
            if ($wordcount_remaining <= 0) {
                $summary .= $word . " ";
                break;
            }
            $summary .= $word . " ";
        }
        // error_log("cut_at_wordcount; Original wordcount: " . $original_wordcount . " | Summary wordcount: " . count(explode(" ", $summary)));
        return $summary;
    }
}