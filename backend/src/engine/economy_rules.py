import math
from decimal import Decimal

def calculate_price(base_value: Decimal, demand_multiplier: Decimal, supply_pool: int) -> Decimal:
    """
    Calculates dynamic commodity prices using a logarithmic supply-demand curve:
    Price = Base Value * (Demand Multiplier / ln(Supply Pool + 2))
    
    Enforces a price floor of 15% and a ceiling of 1000% of the item's base value.
    """
    # Safeguard supply pool boundaries
    pool = max(0, supply_pool)
    
    # ln(Supply Pool + 2) to avoid Division by Zero and Natural Log of zero/negatives
    ln_supply = math.log(pool + 2)
    
    # Apply dynamic multiplier calculation
    raw_factor = float(demand_multiplier) / ln_supply
    raw_price = float(base_value) * raw_factor
    
    # Clamp price bounds
    floor_value = float(base_value) * 0.15
    ceiling_value = float(base_value) * 10.00
    
    final_price = max(floor_value, min(raw_price, ceiling_value))
    
    # Return Decimal rounded to two decimal places
    return Decimal(f"{final_price:.2f}")
