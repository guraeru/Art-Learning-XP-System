# xp_core.py

from typing import Dict, Any, List, Optional, Tuple

# --- 定数定義 ---
class Constants:
    """システムで使用する固定値（XPレート、ランク情報）を定義します。"""
    XP_RATES_PER_MINUTE = {
        "フリースケッチ": 20, "応用技法": 50, "基礎技法": 40, "単体技法": 30,
    }
    ACQUISITION_BASE_XP = {
        "応用技法": 8000, "基礎技法": 5000, "単体技法": 3000,
    }
    # ★★★ 修正: 自由投稿作品の基本XPを追加 ★★★
    POST_BASE_XP = 1500
    # ★★★ ----------------------------- ★★★
    EVALUATION_MAP = {
        "A": 5, "B": 4, "C": 3, "D": 2, "E": 1,
    }
    
    TITLES = {
        (1, 5): "Sketcher（スケッチャー）", (6, 10): "Line Artist（ラインアーティスト）",
        (11, 15): "Colorist（カラリスト）", (16, 20): "Illustrator（イラストレーター）",
        (21, 25): "Creative Designer（クリエイティブデザイナー）", (26, 29): "Master Illustrator（マスターイラストレーター）",
        (30, 30): "The Grand Creator（ザ・グランド・クリエータ）", (31, 35): "Diamond Art Virtuoso（アート・ヴィルトゥオーソ）",
        (36, 40): "Visual Alchemist（ビジュアル・アルケミスト）", (41, 45): "Legendary Creator（伝説のクリエイター）",
        (46, 51): "Eternal Art Master（永遠のアートマスター）", 
    }
    RANK_CUMULATIVE_XP = {
        1: 0, 2: 10_000, 3: 25_000, 4: 45_000, 5: 70_000,
        6: 110_000, 7: 170_000, 8: 250_000, 9: 350_000, 10: 480_000,
        15: 1_200_000, 20: 1_800_000, 25: 2_300_000, 30: 2_650_000,
        35: 4_500_000, 40: 7_500_000, 45: 11_000_000, 50: 13_920_000,
        51: 13_920_000
    }

class XPCalculator:
    """XPとランクの計算ロジックを提供します。"""

    @staticmethod
    def calculate_time_xp(activity_type: str, duration_minutes: float) -> int:
        rate = Constants.XP_RATES_PER_MINUTE.get(activity_type)
        return int(duration_minutes) * rate if rate else 0

    @staticmethod
    def calculate_acquisition_xp(technique_type: str, evaluation: str) -> int:
        # ★★★ 修正: 技法が固定リストになければPOST_BASE_XPを使用 ★★★
        base_xp = Constants.ACQUISITION_BASE_XP.get(technique_type)
        if base_xp is None:
            base_xp = Constants.POST_BASE_XP # 自由な作品投稿と見なし、基本XPを適用
            
        if base_xp is None or base_xp <= 0: return 0

        eval_score = Constants.EVALUATION_MAP.get(evaluation.upper(), 0)
        eval_score = max(1, min(5, eval_score))
        return base_xp * eval_score
    # ★★★ ---------------------------------------------------- ★★★

    @staticmethod
    def get_rank_info(total_xp: int) -> Dict[str, Any]:
        """累計XPから現在のランク、称号、次ランクまでの情報を取得します。"""
        current_rank = 1
        xp_to_next_rank = 0
        current_title = "未登録"
        next_xp_goal = 0

        sorted_ranks = sorted(Constants.RANK_CUMULATIVE_XP.keys())
        max_rank = max(sorted_ranks)
        
        xp_start = 0
        for rank in sorted_ranks:
            min_xp = Constants.RANK_CUMULATIVE_XP[rank]
            if total_xp >= min_xp:
                current_rank = rank
                xp_start = min_xp
            else:
                next_xp_goal = min_xp
                xp_to_next_rank = next_xp_goal - total_xp
                break
        else:
            current_rank = max_rank
            next_xp_goal = Constants.RANK_CUMULATIVE_XP[max_rank]
            xp_to_next_rank = 0 

        for (min_r, max_r), title in Constants.TITLES.items():
            if min_r <= current_rank <= max_r:
                current_title = title
                break
        
        return {
            "rank": current_rank,
            "title": current_title,
            "total_xp": total_xp,
            "xp_to_next_rank": xp_to_next_rank,
            "next_xp_goal": next_xp_goal,
            "xp_start_of_current_level": xp_start
        }