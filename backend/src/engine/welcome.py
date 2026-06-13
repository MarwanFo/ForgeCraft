import io
import logging
import aiohttp
from PIL import Image, ImageDraw, ImageFont

logger = logging.getLogger("forgecraft.welcome")

async def generate_welcome_banner(
    username: str,
    avatar_url: str,
    setting: any
) -> bytes:
    """
    Generates a welcome banner image using Pillow based on customizable WelcomeSetting fields.
    """
    canvas_w = 800
    canvas_h = 400
    
    # 1. Load Background Image or create fallback
    img = None
    if setting.background_url:
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(setting.background_url) as resp:
                    if resp.status == 200:
                        bg_bytes = await resp.read()
                        img = Image.open(io.BytesIO(bg_bytes)).convert("RGBA")
                        img = img.resize((canvas_w, canvas_h), Image.Resampling.LANCZOS)
        except Exception as e:
            logger.error(f"Failed to fetch background welcome url {setting.background_url}: {e}")
            
    if img is None:
        # Fallback: elegant slate gradient or solid background
        img = Image.new("RGBA", (canvas_w, canvas_h), (24, 24, 27, 255)) # Slate gray
        
    draw = ImageDraw.Draw(img)
    
    # 2. Render user avatar
    if avatar_url:
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(avatar_url) as resp:
                    if resp.status == 200:
                        av_bytes = await resp.read()
                        av_img = Image.open(io.BytesIO(av_bytes)).convert("RGBA")
                        av_size = setting.avatar_size
                        av_img = av_img.resize((av_size, av_size), Image.Resampling.LANCZOS)
                        
                        # Mask out round circles if specified
                        if setting.avatar_shape == "circle":
                            mask = Image.new("L", (av_size, av_size), 0)
                            mask_draw = ImageDraw.Draw(mask)
                            mask_draw.ellipse((0, 0, av_size, av_size), fill=255)
                            
                            circular_av = Image.new("RGBA", (av_size, av_size), (0, 0, 0, 0))
                            circular_av.paste(av_img, (0, 0), mask=mask)
                            img.paste(circular_av, (setting.avatar_x, setting.avatar_y), mask=circular_av)
                        else:
                            # Render standard square block
                            img.paste(av_img, (setting.avatar_x, setting.avatar_y), mask=av_img)
        except Exception as e:
            logger.error(f"Failed to download/render avatar: {e}")
            
    # 3. Render greeting username text overlay
    try:
        font = ImageFont.load_default()
        # Check standard paths for Arial/Sans-Serif fonts
        for font_name in ["arial.ttf", "calibri.ttf", "cour.ttf"]:
            try:
                font = ImageFont.truetype(font_name, 36)
                break
            except:
                pass
                
        # Draw text at customized coordinates
        draw.text(
            (setting.username_x, setting.username_y),
            username,
            fill=(255, 255, 255, 255),
            font=font
        )
    except Exception as e:
        logger.error(f"Failed to write text overlay: {e}")
        
    # 4. Save PNG back to buffer bytes
    output = io.BytesIO()
    img.save(output, format="PNG")
    output.seek(0)
    return output.getvalue()
