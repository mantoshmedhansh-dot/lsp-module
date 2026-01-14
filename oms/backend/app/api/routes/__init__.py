from fastapi import APIRouter
from . import auth, users, orders, skus, inventory, locations, brands, dashboard

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(orders.router, prefix="/orders", tags=["Orders"])
api_router.include_router(skus.router, prefix="/skus", tags=["SKUs"])
api_router.include_router(inventory.router, prefix="/inventory", tags=["Inventory"])
api_router.include_router(locations.router, prefix="/locations", tags=["Locations"])
api_router.include_router(brands.router, prefix="/brands", tags=["Brands"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
