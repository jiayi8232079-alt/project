import re
from dataclasses import dataclass


@dataclass(frozen=True)
class Recipe:
    name: str
    ingredients: tuple[str, ...]
    nutrition: str
    cautions: tuple[str, ...]
    goals: tuple[str, ...]
    tastes: tuple[str, ...]
    people: tuple[str, ...]
    meal_types: tuple[str, ...]
    cooking_minutes: int
    allergens: tuple[str, ...] = ()


@dataclass(frozen=True)
class RecipeMatch:
    recipe: Recipe
    score: int
    reasons: tuple[str, ...]


RECIPES: tuple[Recipe, ...] = (
    Recipe(
        name="香菇鸡胸糙米饭",
        ingredients=("鸡胸肉", "香菇", "西兰花", "糙米"),
        nutrition="优质蛋白搭配全谷物和高纤维蔬菜，饱腹感好，适合控油控糖的正餐。",
        cautions=("鸡胸肉少油煎或水煮后撕条", "糙米控制在小半碗，避免主食过量"),
        goals=("高蛋白", "低脂", "控糖", "均衡"),
        tastes=("清淡", "咸鲜"),
        people=("elderly", "family"),
        meal_types=("午餐", "晚餐"),
        cooking_minutes=30,
        allergens=("肉类",),
    ),
    Recipe(
        name="番茄豆腐鸡蛋汤",
        ingredients=("番茄", "豆腐", "鸡蛋", "青菜"),
        nutrition="豆腐和鸡蛋补充蛋白质，番茄提供维生素和自然酸甜味，整体清爽易消化。",
        cautions=("少放盐，可用番茄酸味提鲜", "鸡蛋过敏或豆制品忌口时不要选择"),
        goals=("低盐", "高蛋白", "易消化", "均衡"),
        tastes=("清淡", "酸甜"),
        people=("elderly", "child", "family"),
        meal_types=("早餐", "午餐", "晚餐"),
        cooking_minutes=15,
        allergens=("鸡蛋", "豆制品"),
    ),
    Recipe(
        name="清蒸鲈鱼配西兰花",
        ingredients=("鲈鱼", "西兰花", "姜", "葱"),
        nutrition="鱼肉脂肪相对低，蛋白质质量高，搭配绿叶蔬菜适合需要清淡补蛋白的人群。",
        cautions=("蒸鱼豉油减量，避免额外重盐", "海鲜或鱼类过敏者不推荐"),
        goals=("低脂", "低盐", "高蛋白", "心血管"),
        tastes=("清淡", "鲜"),
        people=("elderly", "family"),
        meal_types=("午餐", "晚餐"),
        cooking_minutes=20,
        allergens=("鱼", "海鲜"),
    ),
    Recipe(
        name="南瓜小米山药粥",
        ingredients=("南瓜", "小米", "山药", "枸杞"),
        nutrition="口感软糯，碳水释放相对温和，适合作为清淡早餐或胃口较弱时的轻食。",
        cautions=("控糖人群减少南瓜用量", "粥类不宜只喝汤水，搭配少量蛋白质更稳妥"),
        goals=("易消化", "低脂", "养胃"),
        tastes=("清淡", "香甜"),
        people=("elderly", "child", "family"),
        meal_types=("早餐", "晚餐"),
        cooking_minutes=35,
    ),
    Recipe(
        name="牛肉彩椒藜麦碗",
        ingredients=("瘦牛肉", "彩椒", "藜麦", "生菜"),
        nutrition="瘦牛肉补充铁和蛋白质，藜麦提供复合碳水，适合需要增强体力的午餐。",
        cautions=("牛肉选择瘦肉并控制份量", "痛风或需限制红肉者减少频次"),
        goals=("高蛋白", "补铁", "均衡"),
        tastes=("咸鲜", "微辣"),
        people=("family",),
        meal_types=("午餐", "晚餐"),
        cooking_minutes=25,
        allergens=("牛肉", "肉类"),
    ),
    Recipe(
        name="虾仁冬瓜豆腐汤",
        ingredients=("虾仁", "冬瓜", "豆腐", "姜"),
        nutrition="冬瓜清爽低能量，虾仁和豆腐提供蛋白质，适合想吃得轻但不想太寡淡的人。",
        cautions=("海鲜或虾过敏者不推荐", "汤底不放浓汤宝，减少钠摄入"),
        goals=("低脂", "低盐", "高蛋白"),
        tastes=("清淡", "鲜"),
        people=("elderly", "family"),
        meal_types=("午餐", "晚餐"),
        cooking_minutes=18,
        allergens=("虾", "海鲜", "豆制品"),
    ),
    Recipe(
        name="鸡丝荞麦凉面",
        ingredients=("鸡胸肉", "荞麦面", "黄瓜", "胡萝卜"),
        nutrition="荞麦面比精白面条更有饱腹感，鸡丝补蛋白，适合想控制油脂的快手餐。",
        cautions=("酱汁少糖少盐，芝麻酱减量", "麸质敏感者需确认荞麦面配料"),
        goals=("低脂", "高蛋白", "快手", "控糖"),
        tastes=("清爽", "咸鲜"),
        people=("family",),
        meal_types=("午餐", "晚餐"),
        cooking_minutes=20,
        allergens=("麸质", "肉类"),
    ),
    Recipe(
        name="菌菇青菜豆腐煲",
        ingredients=("豆腐", "香菇", "金针菇", "青菜"),
        nutrition="植物蛋白和菌菇多糖搭配，脂肪低、纤维足，适合清淡素食或晚餐。",
        cautions=("豆制品忌口者不推荐", "菌菇要充分煮熟"),
        goals=("低脂", "低盐", "素食", "均衡"),
        tastes=("清淡", "鲜"),
        people=("elderly", "family"),
        meal_types=("午餐", "晚餐"),
        cooking_minutes=22,
        allergens=("豆制品",),
    ),
    Recipe(
        name="燕麦蓝莓酸奶杯",
        ingredients=("燕麦", "无糖酸奶", "蓝莓", "奇亚籽"),
        nutrition="燕麦和奇亚籽提供膳食纤维，无糖酸奶补充蛋白质和钙，适合快手早餐。",
        cautions=("选择无糖酸奶，避免蜂蜜或糖浆", "乳制品不耐受者不推荐"),
        goals=("控糖", "快手", "高纤维", "均衡"),
        tastes=("酸甜", "清爽"),
        people=("child", "family"),
        meal_types=("早餐",),
        cooking_minutes=5,
        allergens=("乳制品", "麸质"),
    ),
)


GOAL_ALIASES: dict[str, tuple[str, ...]] = {
    "低盐": ("低盐", "少盐", "控盐", "高血压", "血压", "low salt"),
    "低脂": ("低脂", "少油", "控油", "减脂", "减肥", "轻食", "low fat"),
    "控糖": ("低糖", "控糖", "糖尿病", "血糖", "少糖", "low sugar"),
    "高蛋白": ("高蛋白", "补蛋白", "蛋白", "增肌", "protein"),
    "易消化": ("易消化", "养胃", "胃口弱", "软烂", "清淡好消化"),
    "快手": ("快手", "省时", "简单", "不想做太久", "quick"),
    "素食": ("素食", "吃素", "不要肉", "vegetarian"),
    "补铁": ("补铁", "贫血", "铁", "iron"),
    "心血管": ("心血管", "胆固醇", "护心", "heart"),
    "均衡": ("均衡", "健康", "家常", "营养", "balanced"),
}

TASTE_ALIASES: dict[str, tuple[str, ...]] = {
    "清淡": ("清淡", "淡一点", "不重口"),
    "酸甜": ("酸甜", "番茄味", "开胃"),
    "鲜": ("鲜味", "鲜美", "鲜一点"),
    "咸鲜": ("咸鲜", "家常"),
    "微辣": ("微辣", "辣一点", "辣味"),
    "清爽": ("清爽", "凉拌", "爽口"),
    "香甜": ("香甜", "甜口"),
}

PEOPLE_ALIASES: dict[str, tuple[str, ...]] = {
    "elderly": ("elderly", "老人", "长辈", "老年", "父母"),
    "child": ("child", "儿童", "小孩", "孩子"),
    "family": ("family", "家庭", "全家", "家人"),
}

FOOD_ALIASES: dict[str, tuple[str, ...]] = {
    "鸡胸肉": ("鸡胸", "鸡肉", "鸡丝"),
    "鲈鱼": ("鱼", "鱼肉", "鲈鱼"),
    "虾仁": ("虾", "虾仁"),
    "瘦牛肉": ("牛肉", "瘦牛肉"),
    "豆腐": ("豆腐", "豆制品", "大豆"),
    "鸡蛋": ("鸡蛋",),
    "番茄": ("番茄", "西红柿"),
    "西兰花": ("西兰花", "绿花菜"),
    "香菇": ("香菇", "菌菇", "蘑菇"),
    "金针菇": ("金针菇", "菌菇", "蘑菇"),
    "青菜": ("青菜", "绿叶菜", "蔬菜"),
    "南瓜": ("南瓜",),
    "小米": ("小米",),
    "山药": ("山药",),
    "糙米": ("糙米", "杂粮饭"),
    "藜麦": ("藜麦",),
    "荞麦面": ("荞麦", "面条", "荞麦面"),
    "燕麦": ("燕麦",),
    "无糖酸奶": ("酸奶", "乳制品", "牛奶"),
    "蓝莓": ("蓝莓",),
    "冬瓜": ("冬瓜",),
}

ALLERGEN_ALIASES: dict[str, tuple[str, ...]] = {
    "海鲜": ("海鲜", "水产"),
    "鱼": ("鱼", "鱼类", "鲈鱼"),
    "虾": ("虾", "虾仁"),
    "鸡蛋": ("鸡蛋", "蛋"),
    "豆制品": ("豆制品", "大豆", "豆腐"),
    "乳制品": ("乳制品", "奶", "牛奶", "酸奶", "乳糖"),
    "麸质": ("麸质", "面筋", "小麦", "面条"),
    "牛肉": ("牛肉", "红肉"),
    "肉类": ("肉", "肉类", "不吃肉", "不要肉"),
}

MEAL_TYPES: tuple[str, ...] = ("早餐", "午餐", "晚餐")


def recommend_health_meals(
    need: str = "",
    people: str = "elderly",
    restrictions: str = "",
    ingredients: str = "",
    health_goal: str = "",
    taste: str = "",
    max_cooking_minutes: int = 0,
    limit: int = 3,
) -> str:
    context = " ".join(
        value
        for value in (need, people, restrictions, ingredients, health_goal, taste)
        if value
    )
    goals = extract_labels(context, GOAL_ALIASES)
    taste_context = " ".join(
        value for value in (need, ingredients, health_goal, taste) if value
    )
    tastes = extract_labels(taste_context, TASTE_ALIASES)
    people_labels = extract_labels(people or context, PEOPLE_ALIASES)
    meal_types = extract_meal_types(context)
    wanted_ingredients = extract_food_terms(" ".join((need, ingredients)))
    avoided_terms = extract_avoided_terms(restrictions)
    minutes = max_cooking_minutes or extract_minutes(context)

    matches = [
        match
        for recipe in RECIPES
        if not has_conflict(recipe, avoided_terms)
        for match in (
            score_recipe(
                recipe,
                goals,
                tastes,
                people_labels,
                meal_types,
                wanted_ingredients,
                minutes,
            ),
        )
    ]
    matches.sort(key=lambda item: (item.score, -item.recipe.cooking_minutes), reverse=True)

    if not matches:
        return format_no_match(need, people, restrictions, avoided_terms)

    selected = matches[: max(1, limit)]
    return format_recommendations(
        selected,
        need=need,
        people=people,
        restrictions=restrictions,
        avoided_terms=avoided_terms,
        goals=goals,
        tastes=tastes,
        wanted_ingredients=wanted_ingredients,
        max_cooking_minutes=minutes,
    )


def extract_labels(text: str, aliases: dict[str, tuple[str, ...]]) -> set[str]:
    normalized = normalize(text)
    labels: set[str] = set()

    for label, words in aliases.items():
        if any(normalize(word) in normalized for word in words):
            labels.add(label)

    return labels


def extract_meal_types(text: str) -> set[str]:
    normalized = normalize(text)
    return {meal_type for meal_type in MEAL_TYPES if meal_type in normalized}


def extract_minutes(text: str) -> int:
    match = re.search(r"(\d{1,3})\s*(分钟|min|mins|minutes)", normalize(text))
    if not match:
        return 0
    return int(match.group(1))


def extract_food_terms(text: str) -> set[str]:
    normalized = normalize(text)
    terms: set[str] = set()

    for canonical, aliases in FOOD_ALIASES.items():
        if any(normalize(alias) in normalized for alias in aliases):
            terms.add(canonical)

    return terms


def extract_avoided_terms(restrictions: str) -> set[str]:
    normalized = normalize(restrictions)
    avoided: set[str] = set()

    for canonical, aliases in FOOD_ALIASES.items():
        if any(normalize(alias) in normalized for alias in aliases):
            avoided.add(canonical)

    for canonical, aliases in ALLERGEN_ALIASES.items():
        if any(normalize(alias) in normalized for alias in aliases):
            avoided.add(canonical)

    if any(word in normalized for word in ("素食", "吃素", "不吃肉", "不要肉")):
        avoided.update(("肉类", "鱼", "虾", "海鲜"))

    return avoided


def has_conflict(recipe: Recipe, avoided_terms: set[str]) -> bool:
    if not avoided_terms:
        return False

    recipe_terms = set(recipe.ingredients) | set(recipe.allergens)

    for avoided in avoided_terms:
        if avoided in recipe_terms:
            return True

        aliases = FOOD_ALIASES.get(avoided, ()) + ALLERGEN_ALIASES.get(avoided, ())
        if any(alias in recipe_terms for alias in aliases):
            return True

    return False


def score_recipe(
    recipe: Recipe,
    goals: set[str],
    tastes: set[str],
    people_labels: set[str],
    meal_types: set[str],
    wanted_ingredients: set[str],
    max_cooking_minutes: int,
) -> RecipeMatch:
    score = 1
    reasons: list[str] = []

    matched_goals = goals & set(recipe.goals)
    if matched_goals:
        score += len(matched_goals) * 4
        reasons.append("匹配" + "、".join(sorted(matched_goals)))

    matched_tastes = tastes & set(recipe.tastes)
    if matched_tastes:
        score += len(matched_tastes) * 2
        reasons.append("口味偏" + "、".join(sorted(matched_tastes)))

    matched_people = people_labels & set(recipe.people)
    if matched_people:
        score += len(matched_people) * 2
        reasons.append("适合" + format_people(matched_people))

    matched_meals = meal_types & set(recipe.meal_types)
    if matched_meals:
        score += len(matched_meals) * 2
        reasons.append("适合" + "、".join(sorted(matched_meals)))

    matched_ingredients = wanted_ingredients & set(recipe.ingredients)
    if matched_ingredients:
        score += len(matched_ingredients) * 5
        reasons.append("用到" + "、".join(sorted(matched_ingredients)))

    if max_cooking_minutes:
        if recipe.cooking_minutes <= max_cooking_minutes:
            score += 2
            reasons.append(f"{recipe.cooking_minutes}分钟内可做")
        else:
            score -= 3

    if not reasons:
        reasons.append("默认清淡均衡")

    return RecipeMatch(recipe=recipe, score=score, reasons=tuple(reasons))


def format_recommendations(
    matches: list[RecipeMatch],
    need: str,
    people: str,
    restrictions: str,
    avoided_terms: set[str],
    goals: set[str],
    tastes: set[str],
    wanted_ingredients: set[str],
    max_cooking_minutes: int,
) -> str:
    intro_parts = []
    if people:
        intro_parts.append(f"面向{display_people_text(people)}")
    if need:
        intro_parts.append(f"需求是“{need}”")
    if goals:
        intro_parts.append("重点考虑" + "、".join(sorted(goals)))
    if tastes:
        intro_parts.append("口味偏" + "、".join(sorted(tastes)))
    if wanted_ingredients:
        intro_parts.append("优先使用" + "、".join(sorted(wanted_ingredients)))
    if max_cooking_minutes:
        intro_parts.append(f"尽量控制在{max_cooking_minutes}分钟内")

    intro = "，".join(intro_parts) if intro_parts else "没有额外条件，先给一组清淡均衡的默认健康推荐"
    lines = [f"已根据{intro}，推荐以下菜谱："]

    if restrictions:
        if avoided_terms:
            lines.append(f"已避开忌口/过敏：{format_terms(avoided_terms)}。")
        else:
            lines.append(f"已记录注意事项：{restrictions}。")

    for index, match in enumerate(matches, start=1):
        recipe = match.recipe
        notes = list(recipe.cautions)
        notes.extend(dynamic_cautions(goals, restrictions))

        lines.extend(
            (
                "",
                f"{index}. {recipe.name}",
                f"主要食材：{format_terms(recipe.ingredients)}。",
                f"营养说明：{recipe.nutrition}",
                f"推荐理由：{format_terms(match.reasons)}。",
                f"注意事项：{format_terms(notes)}。",
            )
        )

    lines.append("")
    lines.append("如有明确医嘱、严重过敏或慢病用药要求，请优先按医生或营养师建议调整。")
    return "\n".join(lines)


def format_no_match(
    need: str,
    people: str,
    restrictions: str,
    avoided_terms: set[str],
) -> str:
    lines = [
        "暂时没有找到完全避开忌口且匹配条件的本地菜谱。",
        f"人群：{display_people_text(people) if people else '未指定'}。",
        f"需求：{need or '默认健康推荐'}。",
    ]

    if restrictions:
        lines.append(f"忌口/过敏：{format_terms(avoided_terms) or restrictions}。")

    lines.append("建议先选择清蒸、炖煮、少油少盐的基础做法，并补充可用食材后再查询。")
    return "\n".join(lines)


def dynamic_cautions(goals: set[str], restrictions: str) -> list[str]:
    cautions: list[str] = []

    if "低盐" in goals:
        cautions.append("盐和酱油都减量，避免再搭配腌制食品")
    if "控糖" in goals:
        cautions.append("不额外加糖，主食按个人血糖情况控制份量")
    if "低脂" in goals:
        cautions.append("优先蒸、煮、炖，少用煎炸和厚重酱料")
    if "高蛋白" in goals:
        cautions.append("肾功能异常者需按医嘱控制蛋白摄入")
    if not restrictions:
        cautions.append("如果存在过敏或忌口，下一次可以直接说明")

    return cautions


def format_people(labels: set[str]) -> str:
    names = {
        "elderly": "老人",
        "child": "儿童",
        "family": "家庭",
    }
    return "、".join(names.get(label, label) for label in sorted(labels))


def display_people_text(people: str) -> str:
    labels = extract_labels(people, PEOPLE_ALIASES)
    if labels:
        return format_people(labels)
    return people


def format_terms(values) -> str:
    if isinstance(values, set):
        values = sorted(values)
    return "、".join(str(value) for value in values if value)


def normalize(text: str) -> str:
    return (text or "").strip().lower()
