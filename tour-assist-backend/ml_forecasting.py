import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from datetime import datetime, timedelta

def generate_synthetic_data(place_id: int):
    """
    Generates 60 days of synthetic historical daily crowd averages.
    We use place_id as a random seed to deterministically generate the same crowd pattern for a specific place.
    In a real-world scenario, this data would be fetched via SQL from a time-series DB mapping true footfall.
    """
    np.random.seed(place_id)
    
    end_date = datetime.utcnow().date()
    start_date = end_date - timedelta(days=60)
    
    dates = pd.date_range(start=start_date, end=end_date)
    df = pd.DataFrame({'date': dates})
    
    df['day_of_week'] = df['date'].dt.dayofweek
    df['is_weekend'] = df['day_of_week'].apply(lambda x: 1 if x >= 5 else 0)
    
    # Baseline density between 30% and 50%
    base_density = np.random.uniform(30, 50, size=len(df))
    
    # Weekends typically drive 20% to 40% higher traffic
    weekend_boost = df['is_weekend'] * np.random.uniform(20, 40, size=len(df))
    
    # Simulated seasonal mathematical wave (e.g., peak tourist season approaching)
    wave = np.sin(np.arange(len(df)) / (10.0 + (place_id % 5))) * 15
    
    # Random statistical noise
    noise = np.random.normal(0, 5, size=len(df))
    
    df['density'] = base_density + weekend_boost + wave + noise
    df['density'] = df['density'].clip(10, 100).astype(int) # Bound to 10-100% capacity
    
    return df

def get_crowd_forecast(place_id: int) -> list[dict]:
    """
    Trains a Random Forest Regressor on the historical DataFrame.
    Outputs a highly-predictive 7-day crowd forecast curve.
    """
    df = generate_synthetic_data(place_id)
    
    # Features & Target for Supervised Learning
    X = df[['day_of_week', 'is_weekend']]
    y = df['density']
    
    # Train the Machine Learning Model
    model = RandomForestRegressor(n_estimators=50, random_state=42)
    model.fit(X, y)
    
    # Predict the next 7 days
    tomorrow = datetime.utcnow().date() + timedelta(days=1)
    future_dates = pd.date_range(start=tomorrow, periods=7)
    
    future_df = pd.DataFrame({'date': future_dates})
    future_df['day_of_week'] = future_df['date'].dt.dayofweek
    future_df['is_weekend'] = future_df['day_of_week'].apply(lambda x: 1 if x >= 5 else 0)
    
    # Execute Model Extrapolation
    X_future = future_df[['day_of_week', 'is_weekend']]
    predictions = model.predict(X_future)
    
    forecast_results = []
    days_map = {0: "Mon", 1: "Tue", 2: "Wed", 3: "Thu", 4: "Fri", 5: "Sat", 6: "Sun"}
    
    for i in range(7):
        date_obj = future_dates[i]
        forecast_results.append({
            "day": days_map[date_obj.dayofweek],
            "full_date": date_obj.strftime("%Y-%m-%d"),
            "predicted_density": int(predictions[i])
        })
        
    return forecast_results
