import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Preferences } from "./entities/preferences.entity.js";
import { PreferencesService } from "./preferences.service.js";
import { PreferencesController } from "./preferences.controller.js";


@Module({
    imports: [TypeOrmModule.forFeature([Preferences])],
    providers: [PreferencesService],
    controllers: [PreferencesController],
    exports: [PreferencesService]
})
export class PreferencesModule {

}
